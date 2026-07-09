import Link from "next/link";

export function Logo() {
  return (
    <Link className="logo" href="/">
      <span className="logoMark">M</span>
      <span>MONIK</span>
      <strong>EXCHANGE</strong>
    </Link>
  );
}
