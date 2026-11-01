/* eslint-disable @next/next/no-img-element -- recipe photos come from arbitrary hosts */

import { PlateIcon } from "./icons";

export function RecipeImage({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-leaf-soft text-accent/50 ${className}`} aria-hidden>
        <PlateIcon width={40} height={40} strokeWidth={1.2} />
      </div>
    );
  }
  return <img src={src} alt={alt} className={`object-cover ${className}`} />;
}
