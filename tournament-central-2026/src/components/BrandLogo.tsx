import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
  sizes?: string;
};

export function BrandLogo({
  className = "",
  decorative = false,
  priority = false,
  sizes = "128px",
}: BrandLogoProps) {
  return (
    <Image
      className={className}
      src="/brand/east-coast-big-playas-logo.png"
      alt={decorative ? "" : "East Coast Big Playas duck logo"}
      aria-hidden={decorative || undefined}
      width={1254}
      height={1254}
      priority={priority}
      sizes={sizes}
    />
  );
}
