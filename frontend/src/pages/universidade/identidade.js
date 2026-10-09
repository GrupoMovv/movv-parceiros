// Cor e ícone de cada módulo da Universidade MOVV Partner, do "Guia Visual de
// Identidade dos Módulos" (Downloads/MOVV PARTNER). O dourado do Módulo 6 virou
// verde-oliva, como o próprio guia sugere, para o dourado ficar só na Certificação (11).
import {
  ClipboardList, Handshake, Settings2, Target, MessageCircle, Briefcase, DollarSign, MonitorSmartphone,
  MessageSquare, Shield, TrendingUp, Award, FolderOpen, Map, LayoutDashboard, Mic, Network, BookOpen,
} from 'lucide-react';

const IDENTIDADE = {
  0:  { cor: '#4A4A4A', icone: ClipboardList },
  1:  { cor: '#3C8C3C', icone: Handshake },
  2:  { cor: '#1B5FAE', icone: Settings2 },
  3:  { cor: '#C0392B', icone: Target },
  4:  { cor: '#D6336C', icone: MessageCircle },
  5:  { cor: '#6B4FA0', icone: Briefcase },
  6:  { cor: '#6B7F2A', icone: DollarSign },
  7:  { cor: '#0B1E3C', icone: MonitorSmartphone },
  8:  { cor: '#2E86AB', icone: MessageSquare },
  9:  { cor: '#E67E22', icone: Shield },
  10: { cor: '#27AE60', icone: TrendingUp },
  11: { cor: '#B8860B', icone: Award },
  12: { cor: '#7F8C8D', icone: FolderOpen },
  13: { cor: '#8E44AD', icone: Map },
  14: { cor: '#16A085', icone: LayoutDashboard },
  15: { cor: '#F39C12', icone: Mic },
  16: { cor: '#0B1E3C', icone: Network },
};

export const identidade = numero => IDENTIDADE[numero] || { cor: '#0C2D48', icone: BookOpen };

export const SITUACAO = {
  em_breve:     { rotulo: 'Em breve',     classe: 'bg-slate-100 text-slate-500 border-slate-200' },
  bloqueado:    { rotulo: 'Bloqueado',    classe: 'bg-slate-100 text-slate-500 border-slate-200' },
  disponivel:   { rotulo: 'Disponível',   classe: 'bg-blue-50 text-movv-900 border-blue-200' },
  em_andamento: { rotulo: 'Em andamento', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
  atualizar:    { rotulo: 'Atualizar',    classe: 'bg-orange-50 text-orange-700 border-orange-300' },
  concluido:    { rotulo: 'Concluído',    classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export const NIVEIS = { mobile: 'Mobile', point: 'Point', hub: 'Hub', regional: 'Regional' };

export const dataBR = d => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
export const pct = n => `${Math.round((Number(n) || 0) * 100)}%`;
