import { useRef } from 'react';
import { Calendar } from 'lucide-react';

export default function DateInput({ value, onChange, className, min, max, required }) {
  const parts = value ? value.split('-') : [];
  const displayValue = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : '';
  const dateInputRef = useRef(null);

  const handleClick = (e) => {
    try {
      if (e.target.showPicker) {
        e.target.showPicker();
      }
    } catch (err) {
      // Ignore
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={displayValue}
        readOnly
        placeholder="วัน/เดือน/ปี"
        className={`${className} pr-10 cursor-pointer`}
      />
      <Calendar 
        size={18} 
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" 
      />
      <input
        ref={dateInputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        onChange={onChange}
        onClick={handleClick}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ colorScheme: 'dark' }}
      />
    </div>
  );
}
