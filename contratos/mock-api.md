# API del servicio de reservas de prueba

Servicio remoto con reservas ficticias. WorkFactory entrega credenciales propias para cada candidato. No necesitas conocer el producto real ni implementar este servicio. `receipt` es la confirmación de que un cambio quedó guardado.

**Base:** `https://join.workfactory.es/ai-reservations/v1`

Añade las rutas de este contrato a esa base. Por ejemplo, `GET /stays/STAY-A1` corresponde a `GET https://join.workfactory.es/ai-reservations/v1/stays/STAY-A1`.

## Credenciales y escenario

Salvo `GET /health`, las rutas requieren `Authorization: Bearer <clave privada>`. Usa las claves entregadas por WorkFactory. Las sesiones `guest-a1` y similares de tu aplicación **no sirven como claves remotas**.

| Variable del servidor | Acceso remoto |
| --- | --- |
| `RESERVATIONS_GUEST_A1_TOKEN` | Leer y comprobar disponibilidad de `STAY-A1` |
| `RESERVATIONS_GUEST_A2_TOKEN` | Leer y comprobar disponibilidad de `STAY-A2` |
| `RESERVATIONS_GUEST_B1_TOKEN` | Leer y comprobar disponibilidad de `STAY-B1` |
| `RESERVATIONS_MANAGER_A_TOKEN` | Leer, comprobar, aplicar y consultar operaciones de `hotel-alba`, organización `org-coral` |
| `RESERVATIONS_MANAGER_B_TOKEN` | Lo mismo para `hotel-alba-b`, organización `org-brisa` |
| `RESERVATIONS_TESTER_TOKEN` | Solo rutas `/test/...` de tu entorno |

Tu servidor resuelve la sesión y los permisos y elige una clave de esta tabla. Las claves quedan fuera del navegador, del modelo y de Git. El hotel procede de la clave: las rutas de negocio no aceptan `hotel_id`, `org_id` ni `role` en el cuerpo. La habitación `101` existe en ambos hoteles para probar el aislamiento.

Identifica tu cliente con `User-Agent: WorkFactory-Technical-Test/1.0`, también en las consultas de salud. Si Python devuelve un 403 con `error code: 1010`, procede de Cloudflare: añade ese encabezado; no es una respuesta de permisos del servicio.

En cada llamada autenticada envía `X-Test-Scenario` con `normal`, `transient-503`, `response-lost` o `stale-availability`. Si se omite, se usa `normal`. Configura el valor mediante `RESERVATIONS_SCENARIO` en tu servidor; no aceptes que lo cambie el huésped o la IA. Cada combinación de candidato y escenario tiene reservas, operaciones y contadores independientes.

## Datos iniciales

Todas las horas son del **10 de noviembre de 2026, UTC**. Las tres reservas empiezan con versión 1.

| Reserva | Organización | Hotel | Habitación | Salida inicial |
| --- | --- | --- | --- | --- |
| `STAY-A1` | `org-coral` | `hotel-alba` | `101` | 11:00 |
| `STAY-A2` | `org-coral` | `hotel-alba` | `102` | 11:00 |
| `STAY-B1` | `org-brisa` | `hotel-alba-b` | `101` | 10:00 |

`datos/estancias.json` ayuda a entender el punto de partida. Consulta el servicio para conocer el estado vigente y la disponibilidad.

## Formato y errores

Los POST requieren `Content-Type: application/json`, un objeto JSON y un cuerpo de máximo 16 KiB. Se rechazan claves duplicadas, campos desconocidos, tipos incorrectos y parámetros de consulta. Las fechas usan exactamente `YYYY-MM-DDTHH:MM:SSZ`: fecha válida, UTC, sin fracciones ni offsets.

`operation_key` tiene de 1 a 80 caracteres: primero letra o número, después letras, números, `.`, `_` o `-`. `expected_version` es un entero positivo, nunca un booleano.

Los errores de la API usan:

```json
{"error":{"code":"version_conflict","message":"La estancia ha cambiado; vuelve a consultarla."}}
```

| HTTP | Significado |
| --- | --- |
| 200 | Consulta, control de prueba o repetición de un cambio ya aplicado |
| 201 | Nuevo cambio aplicado |
| 401 | Clave ausente o inválida |
| 403 | Rol o reserva fuera del alcance de la clave |
| 404 | Ruta, reserva u operación no encontrada en el alcance autenticado |
| 409 | Versión antigua, horario no disponible o misma clave de operación con otro contenido |
| 422 | JSON, campos, tipos, fechas o escenario incorrectos |
| 503 | Servicio temporalmente no disponible; interpreta también su código de error |

Una desconexión, un timeout o un 502 del proxy pueden no incluir JSON. Si ocurren al escribir, el resultado es incierto hasta obtener una confirmación. Un 503 genérico tampoco demuestra que no se aplicara el cambio. La excepción es `503 simulated_rejection` del escenario `transient-503`: garantiza que esa petición no escribió.

## Rutas de negocio

### `GET /health`

Pública. Respuesta 200: `{"status":"ok","api_version":"1.0.0"}`.

### `GET /stays/{stay_id}`

Huésped de esa reserva o responsable de su hotel. Respuesta 200:

```json
{"stay_id":"STAY-A1","hotel_id":"hotel-alba","room":"101","checkout_at":"2026-11-10T11:00:00Z","version":1}
```

La disponibilidad se consulta por separado. El servicio no calcula precios: tu aplicación los obtiene de las políticas aprobadas.

### `POST /availability/check`

Mismo alcance que la lectura. Cuerpo exacto:

```json
{"stay_id":"STAY-A1","requested_checkout_at":"2026-11-10T13:00:00Z"}
```

Respuesta 200:

```json
{"available":true,"reason":"available","stay_version":1,"requested_checkout_at":"2026-11-10T13:00:00Z"}
```

Un horario incompatible devuelve 200 con `available:false` y `reason` igual a `not_later_than_current_checkout`, `after_max_checkout` o `cleaning_conflict`, en ese orden de evaluación. La nueva hora debe ser posterior a la salida actual, no superar el máximo permitido y ser anterior al comienzo de limpieza.

Consultar no reserva disponibilidad. Compruébala de nuevo al aprobar: puede haber cambiado. Pedir una hora igual o anterior a la salida actual es información; no crees una propuesta ni un cargo.

### `POST /changes`

Solo responsable de la reserva. Cuerpo exacto:

```json
{"stay_id":"STAY-A1","requested_checkout_at":"2026-11-10T13:00:00Z","expected_version":1,"operation_key":"approve-1"}
```

El servicio comprueba permisos, versión, disponibilidad y repeticiones. Al aplicar incrementa `version`. Respuesta 201, o 200 al repetir exactamente una operación ya aplicada:

```json
{"stay_id":"STAY-A1","checkout_at":"2026-11-10T13:00:00Z","version":2,"operation_key":"approve-1","change_id":"chg_..."}
```

La clave de operación se aísla por candidato, escenario, organización y hotel. Su contenido es `{stay_id,requested_checkout_at,expected_version}`; el orden de las claves JSON no importa. Repetir la misma clave y contenido devuelve el recibo original antes de comprobar la versión actual.

- Misma clave con otro contenido: 409 `operation_key_conflict`, sin cambio.
- Otra clave con una versión ya usada: 409 `version_conflict`.
- Disponibilidad incumplida: 409 `checkout_unavailable`.

El servicio no sabe si una persona aprobó la propuesta: **tu aplicación exige la aprobación** antes de llamar a esta ruta. Guarda una `operation_key` estable antes de escribir y conserva esa clave tras errores y reinicios.

### `GET /operations/{operation_key}`

Solo responsable. Consulta la operación de su hotel, organización, candidato y escenario. Respuesta 200:

```json
{"status":"applied","operation_key":"approve-1","receipt":{"stay_id":"STAY-A1","checkout_at":"2026-11-10T13:00:00Z","version":2,"operation_key":"approve-1","change_id":"chg_..."}}
```

404 `operation_not_found` significa que no se encontró un cambio aplicado con esa clave en ese alcance. El servicio no guarda operaciones pendientes ni rechazadas.

Después de una escritura incierta, un 404 o un error temporal no bastan para declarar fracaso: conserva `pending_verification` y permite consultar de nuevo. No hagas otra escritura a ciegas ni generes otra clave. Cuando recibas un recibo válido y concordante, puedes marcar la propuesta como completada.

## Escenarios automáticos

Los fallos se activan una vez por escenario tras un restablecimiento. Las peticiones inválidas, sin permiso o repetidas no consumen el fallo de una nueva escritura.

| Escenario | Qué ocurre | Qué debes comprobar |
| --- | --- | --- |
| `normal` | Funcionamiento habitual | Aprobación explícita, permisos y un solo cambio |
| `transient-503` | El primer cambio nuevo válido responde 503 `simulated_rejection` sin guardar nada | No mostrar éxito; se puede reintentar con la misma clave y contenido |
| `response-lost` | El primer cambio nuevo válido se guarda, pero se pierde la respuesta. La primera consulta de su operación devuelve 503; las posteriores funcionan | Estado pendiente si aún no hay recibo, consulta posterior y misma clave tras reiniciar |
| `stale-availability` | La primera comprobación disponible de `STAY-A1` devuelve la versión inicial. A continuación cambia automáticamente su disponibilidad y versión | Volver a comprobar al aprobar; la solicitud anterior no puede ejecutarse |

En `stale-availability`, prepara una solicitud a las 14:00. Su primera consulta indica disponibilidad y la siguiente deja de permitirla. La aplicación descubre el cambio consultando de nuevo.

Los fallos son reproducibles, no aleatorios. `response-lost` representa un resultado ambiguo aunque el cliente vea una desconexión, timeout o 502 sin recibo. El primer 503 al consultar no significa que la escritura fallara.

## Controles para tus pruebas

Usa solo `RESERVATIONS_TESTER_TOKEN`. Estos controles son para tu terminal o pruebas automáticas: no se exponen al huésped ni al modelo. Envía el mismo `X-Test-Scenario` que usa tu aplicación.

| Ruta | Cuerpo | Resultado |
| --- | --- | --- |
| `GET /test/scenarios` | Sin cuerpo | `{"scenarios":["normal","transient-503","response-lost","stale-availability"],"default":"normal"}` |
| `GET /test/state` | Sin cuerpo | Estado descrito debajo |
| `POST /test/reset` | `{}` | `{"reset":true,"scenario":"normal"}`, con el escenario seleccionado |

`reset` restaura tus tres reservas, vacía operaciones y contadores y rearma el fallo del escenario seleccionado. No afecta a otros escenarios o candidatos. No existe un control para editar libremente reservas: usa los escenarios para reproducir los cambios automáticos.

`state` devuelve `scenario`, `stays`, `operations`, `counters` y `events`:

- `stays`: las tres reservas con los campos públicos de `GET /stays/{id}`; no expone limpieza ni máximo interno.
- `operations`: cambios aplicados, con `hotel_id`, `operation_key` y `receipt`.
- `counters`: `change_requests`, `applied_changes`, `idempotent_replays`, `conflicts`, `simulated_timeouts`, `simulated_rejections`, `simulated_receipt_failures` y `simulated_stale_changes`.
- `events`: eventos del servicio con `event`, `hotel_id`, `operation_key` y `created_at`.

`change_requests` cuenta escrituras con cuerpo válido y responsable autorizado, incluidos conflictos y repeticiones; `applied_changes`, cambios efectivos; `conflicts`, errores 409; y `idempotent_replays`, recibos devueltos por repetir una operación. Los contadores restantes indican los fallos automáticos activados.

Ejemplo de restablecimiento, con las variables cargadas:

```bash
curl -X POST "$RESERVATIONS_BASE_URL/test/reset" \
  -H "Authorization: Bearer $RESERVATIONS_TESTER_TOKEN" \
  -H 'User-Agent: WorkFactory-Technical-Test/1.0' \
  -H "X-Test-Scenario: $RESERVATIONS_SCENARIO" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Consulta `/test/state` para contrastar cuántas peticiones y cambios se produjeron. Tu solución implementa la IA, las políticas documentales, las propuestas, la persistencia, los permisos de la aplicación y la aprobación humana.
