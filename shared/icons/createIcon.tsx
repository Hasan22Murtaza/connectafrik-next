import * as React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  title?: string;
}

export type Icon = React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<SVGSVGElement>
>;

export function createIcon(
  displayName: string,
  children: React.ReactNode,
  viewBox = "0 0 24 24"
): Icon {
  const Component = React.forwardRef<SVGSVGElement, IconProps>(
    (
      {
        size = 24,
        strokeWidth = 2,
        absoluteStrokeWidth,
        className,
        color = "currentColor",
        title,
        children: _ignored,
        ...rest
      },
      ref
    ) => {
      const computedStrokeWidth = absoluteStrokeWidth
        ? (Number(strokeWidth) * 24) / Number(size)
        : strokeWidth;

      return (
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox={viewBox}
          fill="none"
          stroke={color}
          strokeWidth={computedStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden={title ? undefined : true}
          role={title ? "img" : undefined}
          {...rest}
        >
          {title ? <title>{title}</title> : null}
          {children}
        </svg>
      );
    }
  );

  Component.displayName = displayName;
  return Component;
}
