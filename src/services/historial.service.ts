import { supabase } from '@/lib/supabase'
import type {
  UUID,
  EntidadTipo,
  HistorialEvento,
  Comentario,
} from '@/types'

export async function registrarEvento(
  entidadTipo: EntidadTipo,
  entidadId: UUID,
  userId: UUID,
  accion: string,
  valorAnterior?: string,
  valorNuevo?: string,
  comentario?: string,
): Promise<{ data: HistorialEvento | null; error: unknown }> {
  const { data, error } = await supabase
    .from('historial_eventos')
    .insert({
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      usuario_id: userId,
      accion,
      valor_anterior: valorAnterior ?? null,
      valor_nuevo: valorNuevo ?? null,
      comentario: comentario ?? null,
    })
    .select('*, usuario:profiles(*)')
    .single()

  return { data: data as HistorialEvento | null, error }
}

export async function getHistorial(
  entidadTipo: EntidadTipo,
  entidadId: UUID,
): Promise<{ data: HistorialEvento[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from('historial_eventos')
    .select('*, usuario:profiles(*)')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('created_at', { ascending: false })

  return { data: data as HistorialEvento[] | null, error }
}

export async function addComentario(
  entidadTipo: EntidadTipo,
  entidadId: UUID,
  userId: UUID,
  texto: string,
): Promise<{ data: Comentario | null; error: unknown }> {
  const { data, error } = await supabase
    .from('comentarios')
    .insert({
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      usuario_id: userId,
      texto,
    })
    .select('*, usuario:profiles(*)')
    .single()

  return { data: data as Comentario | null, error }
}

export async function getComentarios(
  entidadTipo: EntidadTipo,
  entidadId: UUID,
): Promise<{ data: Comentario[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from('comentarios')
    .select('*, usuario:profiles(*)')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('created_at', { ascending: true })

  return { data: data as Comentario[] | null, error }
}
