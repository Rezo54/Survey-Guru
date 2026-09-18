import Link from 'next/link';
import s from '../app/public.module.css';
export default function PublicNav() { return <nav className={s.nav} aria-label="Public navigation"><Link className={s.brand} href="/"><img src="/brand/survey-guru-symbol.png" alt="Survey Guru — See more. Know sooner. Move further." width="180" height="150"/></Link><div className={s.links}><Link href="/about">About us</Link><Link href="/demo">View demo</Link><Link href="/consultation">Book a consultation</Link><Link className={s.secondary} href="/sign-in">Sign in →</Link></div></nav>; }
