interface ChevronDownIconProps {
  className?: string;
}

export function ChevronDownIcon({ className }: ChevronDownIconProps) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: 'var(--fui-current-icon-size)', height: 'var(--fui-current-icon-size)' }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.002 10c-.891 0-1.337 1.077-.707 1.707l3.586 3.586a1 1 0 0 0 1.414 0l3.586-3.586c.63-.63.184-1.707-.707-1.707H8.002Z"
        fill="currentColor"
      />
    </svg>
  );
}
