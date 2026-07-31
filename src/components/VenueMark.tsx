/**
 * A venue's identity mark: the uploaded logo when one exists, the emoji
 * otherwise. Size via className — give it box classes for the image AND a
 * text size for the emoji fallback (e.g. "h-9 w-9 text-2xl").
 */
export default function VenueMark({
  venue,
  className = "",
}: {
  venue: { id: string; emoji: string; logoUpdatedAt: Date | null };
  className?: string;
}) {
  if (venue.logoUpdatedAt) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/venues/${venue.id}/logo?v=${venue.logoUpdatedAt.getTime()}`}
        alt=""
        className={`inline-block shrink-0 rounded-xl object-cover ${className}`}
      />
    );
  }
  return <span className={`inline-block shrink-0 ${className}`}>{venue.emoji}</span>;
}
