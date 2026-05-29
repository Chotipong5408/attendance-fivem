const express = require('express');
const prisma = require('../lib/prisma');
const { signToken } = require('../utils/jwt');
const { comparePassword } = require('../utils/bcrypt');
const { logActivity } = require('../utils/activityLog');
const { getIp } = require('../utils/getIp');
const { ensureUserAttendanceForDate } = require('../utils/autoAttendance');
const { userPublicSelect, toPublicUser } = require('../utils/userPublic');
const { validate, loginSchema } = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const config = require('../config');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: config.loginRateLimit.windowMs,
  max: config.loginRateLimit.max,
  message: { error: 'Too Many Requests', message: 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Support login via username or number
    const matchedUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { number: username }
        ]
      },
      select: { ...userPublicSelect, password: true },
    });

    if (!matchedUser) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const isMatch = await comparePassword(password, matchedUser.password);
    
    if (!isMatch) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const token = signToken({ userId: matchedUser.id, role: matchedUser.role });

    if (matchedUser.role === 'user') {
      await ensureUserAttendanceForDate(matchedUser.id, new Date());
    }

    logActivity({
      userId: matchedUser.id,
      action: 'LOGIN',
      details: { method: 'password', icName: matchedUser.icName },
      ipAddress: getIp(req),
    });

    res.json({ token, user: toPublicUser(matchedUser) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

// --- DISCORD OAUTH2 ---

router.get('/discord/url', (req, res) => {
  const clientId = config.discordClientId || process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${config.frontendUrl || process.env.FRONTEND_URL}/auth/discord/callback`);
  
  if (!clientId) {
    return res.status(500).json({ error: 'Server Error', message: 'Discord Client ID not configured.' });
  }

  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds.members.read`;
  res.json({ url });
});

router.post('/discord/callback', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Bad Request', message: 'No code provided' });

    const clientId = config.discordClientId || process.env.DISCORD_CLIENT_ID;
    const clientSecret = config.discordClientSecret || process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = `${config.frontendUrl || process.env.FRONTEND_URL}/auth/discord/callback`;
    const guildId = config.discordGuildId || process.env.DISCORD_GUILD_ID;
    const roleId = config.discordRoleId || process.env.DISCORD_ROLE_ID;

    // 1. Get Access Token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('Discord Token Error:', tokenData);
      return res.status(401).json({ error: 'Unauthorized', message: 'Discord authentication failed.' });
    }

    const { access_token } = tokenData;

    // 2. Get User Profile
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const discordUser = await userRes.json();

    // 3. Get Guild Member Info (Check Role)
    const memberRes = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    
    if (memberRes.status === 404) {
      const existingUser = await prisma.user.findUnique({ where: { discordId: discordUser.id } });
      if (existingUser) {
        await prisma.user.delete({ where: { discordId: discordUser.id } });
      }
      return res.status(403).json({ error: 'Forbidden', message: 'คุณไม่ได้อยู่ในเซิร์ฟเวอร์ Discord ของแก๊ง ข้อมูลของคุณถูกลบออกจากระบบแล้ว' });
    }
    
    const memberData = await memberRes.json();
    if (!memberData.roles || !memberData.roles.includes(roleId)) {
      const existingUser = await prisma.user.findUnique({ where: { discordId: discordUser.id } });
      if (existingUser) {
        await prisma.user.delete({ where: { discordId: discordUser.id } });
      }
      return res.status(403).json({ error: 'Forbidden', message: 'คุณไม่มียศที่กำหนด ข้อมูลของคุณถูกลบออกจากระบบแล้ว' });
    }

    // 4. Find or Create User
    const discordId = discordUser.id;
    const discordAvatar = discordUser.avatar 
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png` 
      : null;
    const discordUsername = discordUser.username;

    let user = await prisma.user.findUnique({ where: { discordId } });

    if (!user) {
      // Auto-create new user
      user = await prisma.user.create({
        data: {
          discordId,
          username: discordUsername,
          icName: memberData.nick || discordUser.global_name || discordUsername,
          avatar: discordAvatar,
          number: null,
          role: 'user',
        }
      });
    } else {
      // Update avatar/username if changed
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: discordUsername,
          avatar: discordAvatar,
        }
      });
    }

    const token = signToken({ userId: user.id, role: user.role });

    if (user.role === 'user') {
      await ensureUserAttendanceForDate(user.id, new Date());
    }

    logActivity({
      userId: user.id,
      action: 'LOGIN',
      details: { method: 'discord', discordId },
      ipAddress: getIp(req),
    });

    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('Discord Auth Error:', err);
    next(err);
  }
});

module.exports = router;
