# API de la IA simulada

**Base:** `https://join.workfactory.es/ai-model/v1`  
**Modelo:** `wf-late-checkout-mock-v1`

Es un servicio determinista de WorkFactory con datos y contadores separados por candidatura. No llama a un modelo de pago ni ejecuta acciones sobre reservas. Su salida es una interpretación que **tu backend valida** antes de usarla.

## Claves y escenario

| Variable del servidor | Uso |
| --- | --- |
| `LLM_BASE_URL` | Dirección base anterior |
| `LLM_MODEL` | Identificador del modelo anterior |
| `LLM_SCENARIO` | Escenario elegido por tu configuración; inicialmente `normal` |
| `LLM_API_KEY` | Solo `GET /models` y `POST /chat/completions` |
| `LLM_TESTER_TOKEN` | Solo las rutas `/test/...` de tu candidatura |

Salvo `GET /health`, envía `Authorization: Bearer <clave adecuada>` y `User-Agent: WorkFactory-Technical-Test/1.0`. Las dos claves son distintas. No sirven las sesiones de tu aplicación ni las claves de reservas. No incluyas claves en `messages`, registros públicos, navegador o Git.

En las llamadas de IA y de pruebas envía `X-Test-Scenario` con el valor de `LLM_SCENARIO`. Si se omite, se usa `normal`. No aceptes que lo cambien el huésped o una respuesta del modelo. Cada combinación de candidatura y escenario tiene contadores independientes.

## Interpretar un mensaje

`POST /chat/completions`, con `LLM_API_KEY`, `Content-Type: application/json` y cuerpo:

```json
{
  "model": "wf-late-checkout-mock-v1",
  "messages": [
    {"role": "user", "content": "Mañana quiero salir a las 14:00. ¿Se puede?"}
  ]
}
```

Respuesta 200: un objeto de chat con `choices[0].message.content`. Ese campo es **texto que contiene otro JSON**, que debes analizar y validar:

```json
{
  "intent": "late_checkout",
  "requested_time": "14:00",
  "language": "es"
}
```

La interpretación válida usa solo esos tres campos: `intent` igual a `late_checkout`, `requested_time` como hora `HH:MM` válida o `null`, y `language` igual a `es` o `en`. Si falta la hora, pregunta al huésped. Conserva la conversación en tu base de datos; el servicio no la guarda ni completa contexto por ti.

El mock interpreta el último mensaje con `role:user`. Reconoce peticiones sencillas en español e inglés y horas como `14:00`, `14 h` o `1pm`. Sin una hora reconocida devuelve `null`. No es un chat general: las respuestas al huésped, documentos, precios, permisos y aprobación los resuelve tu aplicación. El modelo puede equivocarse; no autoriza cambios.

Ejemplo desde tu terminal, con las variables del `.env` ya cargadas:

```bash
curl "$LLM_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $LLM_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: WorkFactory-Technical-Test/1.0' \
  -H "X-Test-Scenario: $LLM_SCENARIO" \
  --data '{"model":"wf-late-checkout-mock-v1","messages":[{"role":"user","content":"Quiero salir a las 14:00"}]}'
```

### Formato admitido

Es un subconjunto del formato de chat completions: basta un cliente HTTP. No se exige instalar ningún SDK ni conectar otro proveedor.

- Cuerpo de hasta 32 KiB, sin parámetros de consulta, claves duplicadas o campos desconocidos.
- `messages`: entre 1 y 20 objetos, con `role` (`system`, `developer`, `user` o `assistant`) y `content` de texto. Debe haber al menos un mensaje `user`; entre 1 y 8.000 caracteres por contenido y máximo 16.000 en total.
- Opcionales: `temperature` entre 0 y 2; `max_tokens` o `max_completion_tokens` entre 1 y 4.096; `n:1`; `stream:false`; `response_format:{"type":"json_object"}` o `{"type":"text"}`.
- No admite streaming, herramientas, imágenes ni `json_schema`. Pedir un formato válido no evita las salidas defectuosas de los escenarios de prueba.

Usa una sola opción de límite: `max_tokens` o `max_completion_tokens`. Estas opciones se validan por compatibilidad; no alteran ni recortan las respuestas preparadas del mock.

La respuesta incluye `usage` con `prompt_tokens`, `completion_tokens` y `total_tokens`, y `usage_simulated:true`. Son estimaciones de caracteres divididos entre cuatro: sirven para registrar consumo y duración, **no son coste ni facturación real**. No uses esos contadores para decidir si se permite una reserva.

## Fallos automáticos

| `X-Test-Scenario` | Resultado de `POST /chat/completions` |
| --- | --- |
| `normal` | 200, contenido JSON válido; hora o `null` |
| `malformed-json` | 200, pero `message.content` contiene JSON roto |
| `invalid-time` | 200, JSON con hora `29:90` |
| `privilege-fields` | 200, añade `approved:true`, `role:"manager"`, `fee:0` y `hotel_id:"hotel-alba-b"` |
| `transient-503` | Primer intento después de restablecer: 503 y `Retry-After:1`; los siguientes: 200 |

Una salida rota o una hora inválida no debe producir un cambio ni un 500 sin explicación. Los campos extra no dan permisos ni cambian el precio. Puedes rechazar esa salida o descartar explícitamente los campos no permitidos, conservando la validación de los tres campos válidos. Ante un error temporal, usa un reintento limitado o una explicación útil; no anuncies éxito ni crees una aprobación ficticia.

El 503 simulado tiene esta forma:

```json
{"error":{"message":"Servicio temporalmente no disponible.","type":"server_error","code":"temporarily_unavailable"}}
```

Los errores se identifican por su HTTP y `error.code`; no dependas de una frase exacta. Una desconexión o un error del proxy puede no incluir JSON.

## Consultas y controles

- `GET /health`: pública; devuelve 200 y `{ "ok": true, "service": "ai-model", "model": "wf-late-checkout-mock-v1", "simulated": true }`.
- `GET /models`: con `LLM_API_KEY`; lista el modelo disponible con formato `object:"list"` y `data`.
- `GET /test/scenarios`: con `LLM_TESTER_TOKEN`; devuelve `{ "scenarios": [...], "default": "normal", "simulated": true }`.
- `GET /test/state`: con tester y la cabecera del escenario; devuelve `scenario` y `counters`.
- `POST /test/reset`: con tester, la cabecera y cuerpo JSON `{}`; reinicia solo los contadores de tu escenario y devuelve el nuevo estado. Reinicia también tu aplicación si el caso lo requiere.

Los contadores son `completion_requests`, `successful_completions`, `simulated_failures`, `simulated_prompt_tokens` y `simulated_completion_tokens`. No incluyen mensajes, prompts ni documentos. El control de IA no reinicia las reservas; usa su otra clave y su propia API.

`successful_completions` cuenta respuestas HTTP 200, incluidas las que tienen contenido defectuoso. `simulated_failures` cuenta los fallos provocados: una respuesta 200 puede aparecer en ambos. Valida el contenido además del HTTP.

| HTTP | Significado |
| --- | --- |
| 200 | Respuesta de IA, consulta o control de pruebas |
| 401 | Clave ausente o inválida |
| 403 | Clave válida utilizada en una ruta de otro rol |
| 404 | Ruta desconocida |
| 405 | Método HTTP no admitido para esa ruta |
| 408 | Tiempo de lectura de la petición agotado |
| 413 | Cuerpo mayor de 32 KiB |
| 415 | Tipo de contenido distinto de JSON |
| 422 | Modelo, cuerpo, opciones o escenario no admitidos |
| 429 | Límite temporal de peticiones; espera antes de reintentar |
| 503 | Fallo temporal; consulta también el código y limita los reintentos |

El acceso remoto limita cada clave a 240 peticiones por minuto y ráfagas de 32. Un 429 exige esperar y limitar los reintentos; respeta `Retry-After` si está presente. El proxy también puede rechazar un cuerpo mayor de 32 KiB con 413 antes de que llegue al servicio. Esos rechazos pueden no tener JSON ni `X-Request-ID` y no aparecen como intentos del modelo en sus contadores.

Las respuestas emitidas por el servicio incluyen `X-Request-ID`. Guarda ese identificador, cuando exista, y la duración en tu registro privado para correlacionar la llamada con el seguimiento de WorkFactory.
