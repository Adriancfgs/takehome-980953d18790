# Kit de prueba de salida tardía

Lee primero `enunciado.pdf` o `enunciado.md`. Puedes usar cualquier herramienta de IA. Después tendrás que defender el código: explicar tus decisiones, reproducir un fallo y hacer un cambio pequeño. Los hoteles, reservas y documentos son ficticios. La aplicación usa una IA simulada: no necesitas una cuenta de pago ni aportar claves personales.

## Empezar

1. Desde tu página de la prueba descarga el PDF, este ZIP y tu `.env` individual. El ZIP solo incluye `.env.example`, sin claves.
2. Guarda el `.env` en tu backend y añádelo a `.gitignore`. La configuración tiene 13 variables: ocho para reservas y cinco para IA. Nunca envíes claves al navegador, a mensajes de IA o a Git.
3. Crea el repositorio **público de GitHub indicado en tu página** y empieza a subir commits. Mientras no exista o no sea público, el seguimiento aparecerá esperando repositorio. El código de los servicios de WorkFactory no forma parte de tu entrega.
4. Ejecuta tu aplicación localmente. Tienes un máximo de ocho horas, repartidas en cinco días naturales desde «Empezar».

## Los dos servicios

| Servicio | Dirección en tu `.env` | Contrato |
| --- | --- | --- |
| Reservas | `RESERVATIONS_BASE_URL` | `contratos/mock-api.md` |
| IA simulada | `LLM_BASE_URL` | `contratos/llm-api.md` |
| Tu aplicación | La dirección local que elijas | `contratos/app-api.md` |

No tienes que montar ni modificar los servicios remotos. Comprueba su conexión desde la terminal:

```bash
curl -H 'User-Agent: WorkFactory-Technical-Test/1.0' \
  https://join.workfactory.es/ai-reservations/v1/health
curl -H 'User-Agent: WorkFactory-Technical-Test/1.0' \
  https://join.workfactory.es/ai-model/v1/health
```

Envía ese `User-Agent` también desde tu cliente HTTP: evita que Cloudflare bloquee el identificador predeterminado de algunas bibliotecas de Python.

Las sesiones `guest-a1`, `guest-a2`, `guest-b1`, `manager-a` y `manager-b` de `datos/identidades.json` pertenecen a **tu aplicación**. El servicio de reservas usa otras claves, privadas. Tu backend comprueba la sesión y el permiso de la persona antes de elegir la clave remota. El visitante no elige una clave, hotel, rol ni escenario mediante su mensaje o una petición.

## Reproducir errores

Tu backend envía el valor de cada variable de escenario en la cabecera `X-Test-Scenario` del servicio correspondiente. Nunca lo elige el huésped ni la IA.

| Variable | Escenarios |
| --- | --- |
| `RESERVATIONS_SCENARIO` | `normal`, `transient-503`, `response-lost`, `stale-availability` |
| `LLM_SCENARIO` | `normal`, `malformed-json`, `invalid-time`, `privilege-fields`, `transient-503` |

Cada servicio tiene su propia clave de pruebas: `RESERVATIONS_TESTER_TOKEN` o `LLM_TESTER_TOKEN`. Permite consultar contadores y restablecer **solo tu escenario y tus datos**, mediante `/test/state` y `/test/reset`. Son distintas de las claves de negocio; consulta el contrato de cada servicio.

Restablece también la base de datos de tu aplicación antes de cada caso independiente. Los turnos y variantes del mismo caso comparten estado cuando así se indique. Los fallos se activan automáticamente: no tienes que programarlos ni pedir que alguien los provoque. Las reservas y la IA tienen contadores independientes, incluso cuando sus escenarios se llaman igual.

## Contenido

- `datos/identidades.json`: sesiones fijas de huésped y responsable para tu aplicación.
- `datos/estancias.json`: tres reservas iniciales; consulta la API para conocer el estado vigente.
- `datos/documentos.jsonl`: políticas y notas con hotel, audiencia, autoridad y versión.
- `datos/eventos.jsonl`: mensajes de ejemplo.
- `datos/salidas-modelo.jsonl`: salidas válidas y defectuosas para pruebas locales de tu adaptador de IA.
- `datos/casos-publicos.jsonl`: diez grupos de comportamiento que debes comprobar.
- `manifest-sha256.json`: huellas para comprobar que los archivos del kit están completos.

En `eventos.jsonl`, `case_id` y `token` sirven para ejecutar el ejemplo. Al llamar a `POST /api/messages`, envía solo `event_id`, `conversation_id`, `stay_id` y `text`; el token de sesión va en `Authorization`.

La fecha de salida es el 10 de noviembre de 2026 y las horas completas usan UTC, con `Z`. La fecha procede de la reserva: no se requiere interpretar calendarios generales ni cambiar de zona horaria. El mock de IA reconoce un conjunto limitado de horas y expresiones, descrito en su contrato; no evalúa razonamiento general. No necesitas conectar hoteles reales, WhatsApp ni pagos.

## Términos de los archivos

- **API / endpoint:** ruta por la que tu aplicación consulta o envía datos a otro programa.
- **Modelo de IA / LLM:** modelo de lenguaje que interpreta mensajes; aquí lo simula un servicio preparado.
- **Mock / simulado:** servicio o respuesta preparada para probar con datos ficticios.
- **Token de sesión:** código de un usuario de prueba de tu aplicación.
- **Clave del servicio:** credencial privada de tu backend para llamar a las reservas o la IA.
- **Tokens del modelo:** unidades de texto usadas para medir consumo; en esta prueba son estimaciones simuladas, sin coste.
- **Traza:** registro de una petición; `trace_id` es su identificador.
- **Receipt / recibo:** confirmación del servicio de que el cambio quedó guardado.
- **Idempotencia:** repetir la misma operación no aplica el cambio una segunda vez.
- **JSONL:** archivo con un objeto JSON por línea.

En `documentos.jsonl`, `approved_policy` es una política aprobada, `website` información de una web y `untrusted_note` una nota sin autoridad. `org_id` y `hotel_id` señalan organización y hotel; `audience`, quién puede leer el documento; `active`, si está vigente; y `version`, su versión.
