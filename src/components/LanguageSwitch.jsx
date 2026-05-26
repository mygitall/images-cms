import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../utils';
import { useDropdownDismiss } from '../hooks';

function LanguageSwitch({ language, setLanguage }) {
  const [open, setOpen] = useState(false);
  const ref = useDropdownDismiss(open, setOpen);
  const languageOptions = [
    { value: 'en', label: 'English', short: 'EN' },
    { value: 'zh', label: '中文', short: '中' },
    { value: 'ko', label: '한국어', short: '한' }
  ];
  const activeLanguage = languageOptions.find((option) => option.value === language) || languageOptions[0];

  return (
    <div className="dropdownControl languageSwitch" ref={ref}>
      <button
        className={cx('dropdownTrigger', open && 'open')}
        type="button"
        aria-label="Language"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{activeLanguage.short}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="dropdownMenu languageMenu" role="menu">
          {languageOptions.map((option) => (
            <button
              className={cx(option.value === language && 'active')}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === language}
              onClick={() => {
                setLanguage(option.value);
                setOpen(false);
              }}
              key={option.value}
            >
              <span>{option.label}</span>
              <strong>{option.short}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default LanguageSwitch;
