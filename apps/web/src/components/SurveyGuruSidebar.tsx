import Link from 'next/link';
import SurveyGuruSidebarFooter from './SurveyGuruSidebarFooter';
import styles from './SurveyGuruSidebar.module.css';

type SidebarSection = 'dashboard' | 'project-map' | 'field' | 'field-map' | 'opportunities' | 'evidence';

type SurveyGuruSidebarProps = {
    active: SidebarSection;
};

const links: ReadonlyArray<readonly [SidebarSection, string, string, string]> = [
    ['dashboard', '/dashboard', '⌂', 'Dashboard'],
    ['project-map', '/projects/demo/map', '◇', 'Project Map'],
    ['field', '/field', '◎', 'Field Today'],
    ['field-map', '/field/map', '⌖', 'Field Live Map'],
    ['opportunities', '/opportunities/demo', '✦', 'Opportunities'],
];

export default function SurveyGuruSidebar({ active }: SurveyGuruSidebarProps) {
    return (
        <aside className={styles.side}>
            <div className={styles.sidebarTop}>
                <div className={styles.brand}>
                    <img src="/brand/survey-guru-symbol.png" alt="Survey Guru" />
                </div>

                <nav className={styles.nav} aria-label="Survey Guru navigation">
                    {links.map(([section, href, icon, label]) => (
                        <Link
                            className={active === section ? styles.active : undefined}
                            href={href}
                            key={section}
                        >
                            {icon} <span>{label}</span>
                        </Link>
                    ))}
                    <a className={active === 'evidence' ? styles.active : undefined} href="#evidence">
                        ▤ <span>Evidence &amp; QA</span>
                    </a>
                </nav>
            </div>

            <div className={styles.tableMountain} aria-hidden="true" />
            <SurveyGuruSidebarFooter />
        </aside>
    );
}
