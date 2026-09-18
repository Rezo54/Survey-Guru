import Link from 'next/link';
import s from '../app/public.module.css';
export default function PublicNav() { return <nav className={s.nav} aria-label="Public navigation"><Link className={s.brand} href="/">Survey Guru<span style={{color:'#0bd5aa'}}>.</span></Link><div className={s.links}><Link href="/demo">View demo</Link><Link href="/consultation">Book a consultation</Link><Link className={s.secondary} href="/sign-in">Sign in →</Link></div></nav>; }
