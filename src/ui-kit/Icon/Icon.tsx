import { findIcon, iconWidth } from '@/lib/icons';

// A Font Awesome icon by its classes ("fa-solid fa-xmark"), drawn as inline
// SVG in the current text colour. fixedWidth gives every icon the same box,
// so a row of them spaces evenly.
const Icon = ({
  name,
  fixedWidth = false,
}: {
  name: string;
  fixedWidth?: boolean;
}) => {
  const icon = findIcon(name);
  if (!icon) return null;
  const [width, height, path] = icon;
  return (
    <svg
      className="icon"
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: fixedWidth ? '1.25em' : iconWidth(width, height) }}
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" d={path} />
    </svg>
  );
};

export default Icon;
