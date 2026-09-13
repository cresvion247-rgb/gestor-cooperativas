import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/erp/PageHeader';
import ProveedoresTab from '@/components/proveedores/ProveedoresTab';
import LicitacionesTab from '@/components/licitaciones/LicitacionesTab';
import { useI18n } from '@/lib/i18n';

// Módulo de compras: homologación de proveedores y gestión de licitaciones
// con registro de ofertas, comparativa y adjudicación con contrato vinculado.
export default function Proveedores() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('nav.proveedores')} description={t('module.proveedores.desc')} />
      <Tabs defaultValue="proveedores">
        <TabsList>
          <TabsTrigger value="proveedores">{t('prov.tabSuppliers')}</TabsTrigger>
          <TabsTrigger value="licitaciones">{t('prov.tabTenders')}</TabsTrigger>
        </TabsList>
        <TabsContent value="proveedores" className="mt-4"><ProveedoresTab /></TabsContent>
        <TabsContent value="licitaciones" className="mt-4"><LicitacionesTab /></TabsContent>
      </Tabs>
    </>
  );
}