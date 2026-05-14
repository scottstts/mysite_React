import { type HTMLAttributes, type PropsWithChildren } from 'react';

type GlassCardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

const GlassCard = ({ children, className = '', ...props }: GlassCardProps) => (
  <div className={`glass-card ${className}`} {...props}>
    {children}
  </div>
);

export default GlassCard;
