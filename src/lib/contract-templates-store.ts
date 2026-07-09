import { supabase } from "@/integrations/supabase/client";

export type ContractTemplate = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  content: string;
  property_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export async function listTemplates(): Promise<ContractTemplate[]> {
  const { data, error } = await supabase
    .from("contract_templates")
    .select("*")
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContractTemplate[];
}

export async function listTemplatesForProperty(propertyId: string | null): Promise<ContractTemplate[]> {
  const all = await listTemplates();
  if (!propertyId) return all.filter((t) => !t.property_id);
  return all.filter((t) => !t.property_id || t.property_id === propertyId);
}

export type TemplateInput = {
  name: string;
  description?: string | null;
  content: string;
  property_id?: string | null;
  is_default?: boolean;
};

export async function createTemplate(input: TemplateInput): Promise<ContractTemplate> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada");
  if (input.is_default) await clearDefaultsForUser(u.user.id);
  const { data, error } = await supabase
    .from("contract_templates")
    .insert({ ...input, user_id: u.user.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as ContractTemplate;
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<ContractTemplate> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada");
  if (input.is_default) await clearDefaultsForUser(u.user.id, id);
  const { data, error } = await supabase
    .from("contract_templates")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ContractTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("contract_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateTemplate(id: string): Promise<ContractTemplate> {
  const { data, error } = await supabase.from("contract_templates").select("*").eq("id", id).single();
  if (error) throw error;
  const src = data as ContractTemplate;
  return createTemplate({
    name: `${src.name} (cópia)`,
    description: src.description,
    content: src.content,
    property_id: src.property_id,
    is_default: false,
  });
}

async function clearDefaultsForUser(userId: string, exceptId?: string) {
  const q = supabase.from("contract_templates").update({ is_default: false }).eq("user_id", userId).eq("is_default", true);
  if (exceptId) await q.neq("id", exceptId);
  else await q;
}
