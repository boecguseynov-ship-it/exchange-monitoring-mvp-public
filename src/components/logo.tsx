import Link from "next/link";

export function Logo() {
  return (
    <Link className="logo" href="/">
      <span className="logoMark">R</span>
      <span>RATE</span>
      <strong>SCOPE</strong>
    </Link>
  );
}

