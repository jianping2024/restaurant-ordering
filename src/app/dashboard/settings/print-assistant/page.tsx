import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  cloudConfigToForm,
  defaultPrintAgentCloudConfig,
  normalizePrintAgentCloudConfig,
} from '@/lib/print-agent-config';
import type { PrintJobSummary } from '@/types';
import { PrintJobsQueuePanel } from '@/components/dashboard/PrintJobsQueuePanel';
import { PrintAssistantIntro } from '@/components/dashboard/PrintAssistantIntro';
import { PrintAgentPairingPanel } from '@/components/dashboard/PrintAgentPairingPanel';
import { PrintAgentSchedulePanel } from '@/components/dashboard/PrintAgentSchedulePanel';

export default async function PrintAssistantSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user!.id)
    .single();

  const rid = restaurant!.id;

  let initialScheduleForm = cloudConfigToForm(defaultPrintAgentCloudConfig());
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('restaurants')
      .select('print_agent_config')
      .eq('id', rid)
      .single();
    const raw = row?.print_agent_config;
    if (raw && typeof raw === 'object' && Object.keys(raw as object).length > 0) {
      initialScheduleForm = cloudConfigToForm(normalizePrintAgentCloudConfig(raw));
    }
  } catch {
    /* use defaults */
  }

  const { data: jobRows, error: jobsError } = await supabase
    .from('print_jobs')
    .select('id, type, status, created_at, error_message, table_number')
    .eq('restaurant_id', rid)
    .order('created_at', { ascending: false })
    .limit(25);

  const initialJobs: PrintJobSummary[] = jobsError
    ? []
    : ((jobRows || []) as PrintJobSummary[]);

  return (
    <div className="space-y-6">
      <PrintAssistantIntro />
      <PrintAgentSchedulePanel initialForm={initialScheduleForm} />
      <PrintAgentPairingPanel />
      <PrintJobsQueuePanel initialJobs={initialJobs} />
    </div>
  );
}
