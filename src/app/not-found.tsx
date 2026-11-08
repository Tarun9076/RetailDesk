import Link from "next/link";
import { StatusScreen, primaryLink } from "@/components/status-screen";

export default function NotFound() {
  return (
    <StatusScreen
      mark="404"
      title="We could not find that page"
      hint="The address may be wrong, or the page has moved."
      titleHi="यह पेज नहीं मिला"
      hintHi="पता गलत हो सकता है, या पेज हट गया है।"
    >
      <Link href="/" className={primaryLink}>
        Go to the start · शुरुआत पर जाएँ
      </Link>
    </StatusScreen>
  );
}
