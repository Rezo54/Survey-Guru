'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fieldApiOrigin, getFieldToken } from '../app/field/map/field-api';
import SurveyGuruSidebarFooter from './SurveyGuruSidebarFooter';
import styles from './SurveyGuruSidebar.module.css';

type SidebarSection = 'operations' | 'dashboard' | 'project-map' | 'field' | 'field-map' | 'opportunities' | 'explore' | 'evidence' | 'qa' | 'settings' | 'help';

type SurveyGuruSidebarProps = {
    active: SidebarSection;
};

type NavItem = {
    section: SidebarSection;
    href: string;
    icon: string;
    label: string;
};

const permissionsBySection: Record<SidebarSection, string[]> = { dashboard:['report.read'], 'project-map':['coverage.read'], field:['field.capture'], 'field-map':['field.capture'], opportunities:['opportunity.read','report.read'], explore:['opportunity.read','report.read'], evidence:['qa.review'], qa:['qa.review'], settings:['platform.admin'], help:['project.read'], operations:['workspace.admin','supervisor.review','qa.review'] };
const groups: ReadonlyArray<ReadonlyArray<NavItem>> = [
    [
        { section: 'operations', href: '/operations', icon: '▦', label: 'Project areas' },
        { section: 'dashboard', href: '/dashboard', icon: '⌂', label: 'Dashboard' },
        { section: 'project-map', href: '/projects/demo/map', icon: '◇', label: 'Project Map' },
    ],
    [
        { section: 'field', href: '/field', icon: '▣', label: 'Field Today' },
        { section: 'field-map', href: '/field/map', icon: '⌖', label: 'Field Live Map' },
    ],
    [
        { section: 'opportunities', href: '/insights', icon: '▥', label: 'Opportunities' },
        { section: 'explore', href: '/insights', icon: '⌕', label: 'Explore' },
    ],
    [
        { section: 'evidence', href: '/qa', icon: '▤', label: 'Evidence' },
        { section: 'qa', href: '/qa', icon: '◆', label: 'QA' },
    ],
    [
        { section: 'settings', href: '/settings/roles', icon: '⚙', label: 'Settings' },
        { section: 'help', href: '/help', icon: '?', label: 'Help' },
    ],
];

export default function SurveyGuruSidebar({ active }: SurveyGuruSidebarProps) {
    const [permissions, setPermissions] = useState<string[]>([]);
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) try {
                const token = await getFieldToken();
                const response = await fetch(`${fieldApiOrigin()}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
                const body = await response.json() as { authority?: { permissions?: string[] } };
                if (!response.ok) throw new Error('Authority unavailable');
                if (!cancelled) setPermissions(body.authority?.permissions ?? []);
                return;
            } catch {
                if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 450 * (attempt + 1)));
            }
            if (!cancelled) setPermissions([]);
        })();
        return () => { cancelled = true; };
    }, []);
    const visibleGroups = groups.map(group => group.filter(item => permissionsBySection[item.section].some(p => permissions.includes(p)))).filter(group => group.length);
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
                                    aria-label={label}
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
