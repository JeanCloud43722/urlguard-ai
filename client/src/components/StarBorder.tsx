import './StarBorder.css';
import React, { ReactNode } from 'react';

interface StarBorderProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  color?: string;
  speed?: string;
  thickness?: number;
  children?: ReactNode;
}

const StarBorder = React.forwardRef<HTMLButtonElement, StarBorderProps>((
  {
    as: Component = 'button',
    className = '',
    color = 'white',
    speed = '6s',
    thickness = 1,
    children,
    ...rest
  },
  ref
) => {
  return (
    <Component
      ref={ref}
      className={`star-border-container ${className}`}
      style={{
        padding: `${thickness}px 0`,
        ...rest.style
      }}
      {...rest}
    >
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed
        }}
      ></div>
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed
        }}
      ></div>
      <div className="inner-content">{children}</div>
      </Component>
    );
});

StarBorder.displayName = 'StarBorder';

export default StarBorder;
