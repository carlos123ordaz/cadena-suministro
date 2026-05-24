import { supabase } from '@/lib/supabase'
import type { UUID, EntidadTipo, TipoDocumento, DocumentoAdjunto } from '@/types'

const BUCKET = 'documentos'

export async function uploadDocumento(
  entidadTipo: EntidadTipo,
  entidadId: UUID,
  file: File,
  tipoDocumento: TipoDocumento,
  userId: UUID,
): Promise<{ data: DocumentoAdjunto | null; error: unknown }> {
  const ext = file.name.split('.').pop()
  const storagePath = `${entidadTipo}/${entidadId}/${Date.now()}_${file.name}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) return { data: null, error: uploadError }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from('documentos_adjuntos')
    .insert({
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      tipo_documento: tipoDocumento,
      nombre_archivo: file.name,
      url_storage: urlData.publicUrl,
      tamanio_bytes: file.size,
      mime_type: file.type || (ext ? `application/${ext}` : null),
      usuario_id: userId,
    })
    .select('*, usuario:profiles(*)')
    .single()

  return { data: data as DocumentoAdjunto | null, error }
}

export async function getDocumentos(
  entidadTipo: EntidadTipo,
  entidadId: UUID,
): Promise<{ data: DocumentoAdjunto[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from('documentos_adjuntos')
    .select('*, usuario:profiles(*)')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('created_at', { ascending: false })

  return { data: data as DocumentoAdjunto[] | null, error }
}

export async function deleteDocumento(
  id: UUID,
): Promise<{ data: null; error: unknown }> {
  const { data: doc, error: fetchError } = await supabase
    .from('documentos_adjuntos')
    .select('url_storage')
    .eq('id', id)
    .single()

  if (fetchError) return { data: null, error: fetchError }

  const url: string = (doc as { url_storage: string }).url_storage
  const bucketPrefix = `/storage/v1/object/public/${BUCKET}/`
  const storagePath = url.includes(bucketPrefix)
    ? url.split(bucketPrefix)[1]
    : null

  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([storagePath])
    if (storageError) return { data: null, error: storageError }
  }

  const { error } = await supabase
    .from('documentos_adjuntos')
    .delete()
    .eq('id', id)

  return { data: null, error }
}
