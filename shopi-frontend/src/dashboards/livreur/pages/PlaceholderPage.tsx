// src/dashboards/livreur/pages/PlaceholderPage.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PageId } from '../data/livreurData';
import { buildPageMeta } from '../data/livreurData';
import shared from '../styles/Shared.module.css';

const ICONS: Partial<Record<PageId,string>> = { parametres:'fa-gear', profil:'fa-user' };

interface Props { page: PageId; onNavigate: (p: PageId) => void; }

export default function PlaceholderPage({ page, onNavigate }: Props) {
  const { t } = useTranslation();
  const { title } = buildPageMeta(t)[page];
  return (
    <div className={shared.page} style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',gap:16,textAlign:'center' }}>
      <div style={{ width:72,height:72,borderRadius:20,background:'var(--tl-bg)',display:'flex',alignItems:'center',justifyContent:'center' }}>
        <i className={`fas ${ICONS[page]??'fa-circle'}`} style={{ color:'var(--teal)',fontSize:28 }} />
      </div>
      <div style={{ fontFamily:'var(--fd)',fontSize:18,fontWeight:800,color:'var(--navy)' }}>{title}</div>
      <div style={{ fontSize:13,color:'var(--t3)',maxWidth:340,lineHeight:1.6 }}>{t('livreurLayout.placeholder.inProgress')}</div>
      <button onClick={() => onNavigate('overview')} style={{ background:'var(--teal)',color:'#fff',border:'none',borderRadius:'var(--pill)',padding:'11px 24px',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:8 }}>
        <i className="fas fa-arrow-left" /> {t('livreurLayout.placeholder.backHome')}
      </button>
    </div>
  );
}