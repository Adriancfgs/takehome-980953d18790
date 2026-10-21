# Contrato de la aplicación candidata

Este contrato mínimo hace reproducible la revisión. Puedes añadir endpoints y elegir el framework. Los errores incluyen `{ "error": { "code": "...", "message": "..." } }` con mensajes útiles, sin datos ajenos.

«Token» es el código de sesión del usuario de prueba; «LLM», la IA simulada; y «receipt», la confirmación de un cambio guardado. El README explica los demás términos.

## Identidad de demostración

Usa `Authorization: Bearer <token>` según `datos/identidades.json`. Resuelve el rol, hotel y reserva en el backend. Son sesiones simuladas, no tokens JWT. Cada vista presenta al backend su sesión de demostración; no reutilices una sesión de responsable en peticiones autenticadas como huésped. Las llamadas al servicio de reservas las hace tu servidor después de autorizar al actor. Mapea cada sesión de demostración a su clave remota fija: una petición de huésped nunca usa una clave de responsable. No aceptes claves ni escenarios remotos elegidos por un visitante o por la IA. Las claves de ambos servicios nunca se envían al navegador ni se guardan en el repositorio. Las dos claves tester solo sirven para las pruebas, sin conceder permisos de negocio a usuarios de la app.

En este entorno de prueba todos los tokens son conocidos. Los tests simulan cambiar IDs manteniendo el token original. No se evalúa que un atacante que conoce otro token de demostración no pueda usarlo: la autenticación real queda fuera de alcance.

## Mensajes

`POST /api/messages` con token de huésped:

```json
{
  "event_id": "evt-001",
  "conversation_id": "conv-a1",
  "stay_id": "STAY-A1",
  "text": "Quiero salir a las 14:00"
}
```

Respuesta 200:

```json
{
  "event_id": "evt-001",
  "conversation_id": "conv-a1",
  "status": "awaiting_approval",
  "message": "La solicitud de salida a las 14:00, con importe de 25 EUR, está pendiente de aprobación.",
  "proposal_id": "identificador-generado",
  "trace_id": "identificador-generado",
  "replayed": false
}
```

`status`: `needs_input`, `information`, `awaiting_approval`, `declined` o `handoff`. `proposal_id` puede ser null si no hay propuesta. Un duplicado idéntico conserva identificadores y usa `replayed:true`; un duplicado con contenido diferente devuelve 409. Reserva/conversación ajena devuelve 403 o 404 sin revelar contenido. Campos no contemplados se rechazan con 422; no se aceptan roles o aprobaciones del payload.

La clave de deduplicación de eventos es `(actor autenticado, conversation_id, event_id)`. Compara stay_id y text para decidir si un replay es idéntico. Una coincidencia de event_id de otro actor o conversación nunca recupera mensajes ni propuestas ajenos. La conversación queda ligada a su propietario, hotel y reserva al crearla.

`GET /api/conversations/{conversation_id}` devuelve historial y estado, con token del huésped propietario o del responsable de ese hotel. Las trazas internas solo se devuelven al responsable.

## Propuestas

`GET /api/proposals` con token de responsable devuelve `{ "proposals": [...] }` solo de su hotel. Cada propuesta incluye `id`, `stay_id`, `status`, `current_checkout_at`, `requested_checkout_at`, `fee_eur`, `policy_document_id`, `policy_version`, `evidence`, `operation_key` y `receipt` cuando esté comprobada. `evidence` tiene al menos `{document_id,version,quote}`. Puedes añadir campos de versión/estado para revalidación.

Estados de propuesta: `awaiting_approval`, `processing`, `pending_verification`, `completed`, `rejected`, `stale`, `failed`.

- `POST /api/proposals/{id}/approve` sin body, con token de responsable. 200 si completó o es replay completado; 202 si queda pendiente de verificación; 409 si propuesta obsoleta, rechazada o no ejecutable.
- `POST /api/proposals/{id}/reject` sin body. 200 cuando queda rechazada o ya lo estaba; 409 si se empezó a ejecutar o ya está completada. El responsable de otro hotel no puede rechazarla.
- `POST /api/proposals/{id}/reconcile` sin body. Consulta la operación estable; 200 si queda completada o sin cambio; 202 si sigue incierta. Nunca crea una operación nueva.

Si el servicio responde 404 o 503 en la consulta de una operación cuya escritura fue incierta, conserva `pending_verification` y devuelve 202 con una explicación. Ese 404 no es prueba suficiente para declarar fallo definitivo ni lanzar otro cambio. Si la propuesta ya está completada o rechazada, reconciliar devuelve su estado sin ejecutar nada. Se puede verificar automáticamente dentro de approve: si ya tienes un recibo válido, 200 completed es correcto sin pasar por un estado pendiente visible.

Las tres respuestas incluyen `{ "proposal_id": "...", "status": "...", "message": "...", "receipt": null }`, con recibo cuando exista. Token ausente o inválido: 401. Rol de huésped: 403. ID ajeno: 403 o 404, sin modificar propuesta ni consumir su aprobación.

Tu aplicación conecta a la IA simulada con el contrato de `llm-api.md`. Puedes sustituir su cliente por respuestas locales en tests usando `datos/salidas-modelo.jsonl`, siempre con la misma validación. La demo debe llamar al servicio remoto. Las pruebas privadas no dependerán de frases exactas ni de IDs codificados en la lógica.
