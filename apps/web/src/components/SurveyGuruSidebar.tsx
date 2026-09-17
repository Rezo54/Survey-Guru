'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fieldApiOrigin, getFieldToken } from '../app/field/map/field-api';
import SurveyGuruSidebarFooter from './SurveyGuruSidebarFooter';
import styles from './SurveyGuruSidebar.module.css';

type SidebarSection = 'dashboard' | 'project-map' | 'field' | 'field-map' | 'opportunities' | 'explore' | 'evidence' | 'qa' | 'settings' | 'help';

type SurveyGuruSidebarProps = {
    active: SidebarSection;
};

type NavItem = {
    section: SidebarSection;
    href: string;
    icon: string;
    label: string;
};

const groups: ReadonlyArray<ReadonlyArray<NavItem>> = [
    [
        { section: 'dashboard', href: '/dashboard', icon: '⌂', label: 'Dashboard' },
        { section: 'project-map', href: '/projects/demo/map', icon: '◇', label: 'Project Map' },
    ],
    [
        { section: 'field', href: '/field', icon: '▣', label: 'Field Today' },
        { section: 'field-map', href: '/field/map', icon: '⌖', label: 'Field Live Map' },
    ],
    [
        { section: 'opportunities', href: '/opportunities/demo', icon: '▥', label: 'Opportunities' },
        { section: 'explore', href: '/opportunities/demo#explore', icon: '⌕', label: 'Explore' },
    ],
    [
        { section: 'evidence', href: '/qa', icon: '▤', label: 'Evidence' },
        { section: 'qa', href: '/qa', icon: '◆', label: 'QA' },
    ],
    [
        { section: 'settings', href: '/dashboard#settings', icon: '⚙', label: 'Settings' },
        { section: 'help', href: '/dashboard#help', icon: '?', label: 'Help' },
    ],
];

export default function SurveyGuruSidebar({ active }: SurveyGuruSidebarProps) {
    const [administrator, setAdministrator] = useState(false);
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const token = await getFieldToken();
                const response = await fetch(`${fieldApiOrigin()}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
                const body = await response.json() as { authority?: { permissions?: string[] } };
                if (!cancelled) setAdministrator(response.ok && body.authority?.permissions?.includes('workspace.admin') === true);
            } catch { if (!cancelled) setAdministrator(false); }
        })();
        return () => { cancelled = true; };
    }, []);
    const visibleGroups = administrator ? groups : [groups[1]!];
    return (
        <aside className={styles.side}>
            <div className={styles.sidebarTop}>
                <div className={styles.brand}>
                    <img src="/brand/survey-guru-symbol.png" alt="Survey Guru" />
                </div>

                <nav className={styles.nav} aria-label="Survey Guru navigation">
                    {visibleGroups.map((group, groupIndex) => (
                        <div className={styles.navGroup} key={groupIndex}>
                            {group.map(({ section, href, icon, label }) => (
                                <Link
                                    aria-current={active === section ? 'page' : undefined}
                                    className={active === section ? styles.active : undefined}
                                    href={href}
                                    key={section}
                                >
                                    <span className={styles.icon} aria-hidden="true">{icon}</span>
                                    <span className={styles.label}>{label}</span>
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>
            </div>

            <div className={styles.tableMountain} aria-hidden="true" />
            <SurveyGuruSidebarFooter />
        </aside>
    );
}
