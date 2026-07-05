import type { ComponentType } from 'react';

type IconProps = { className?: string };

type Props = {
  icon: ComponentType<IconProps>;
  iconClassName?: string;
  className?: string;
  children: React.ReactNode;
};

export function AuthIconTextRow({ icon: Icon, iconClassName, className, children }: Props) {
  return (
    <div className={className ?? 'flex items-start gap-2.5'}>
      <Icon className={iconClassName ?? 'w-5 h-5 shrink-0 text-brand-gold'} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
