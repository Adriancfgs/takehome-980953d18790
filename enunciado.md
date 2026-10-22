# Una salida más tarde

## El encargo

Construye una web para gestionar peticiones de salida tardía en un hotel. La IA interpreta el mensaje y el servidor comprueba las reglas y la disponibilidad. Un responsable aprueba antes de cambiar la reserva. La web muestra el resultado cuando lo ha comprobado.

WorkFactory aloja **dos servicios de prueba: reservas e IA simulada**, con peticiones HTTP y fallos automáticos. Recibirás sus contratos y tus claves, que guardarás solo en tu servidor. Los datos son ficticios y no necesitas créditos de IA.

**Máximo 8 horas · Defensa de 60 minutos.** Reparte el trabajo en 5 días naturales desde «Empezar». Lenguaje y herramientas a tu elección; ejecución local.

**Puedes usar cualquier herramienta de IA**, también durante la defensa. Después tendrás que defender el código: explicar tus decisiones, reproducir un fallo y hacer un cambio pequeño. No pedimos chats privados.

## El caso de ejemplo

El huésped de la reserva `STAY-A1` escribe: «Mañana quiero salir a las 14:00. ¿Se puede?».

1. La web registra el mensaje.
2. La IA identifica la petición, la hora y el idioma; el servidor valida la respuesta.
3. Consulta la reserva, las reglas del hotel y la disponibilidad.
4. Muestra una propuesta: reserva, hora actual, nueva hora, importe y documento que la respalda. Queda pendiente de aprobación.
5. El responsable aprueba. El servidor vuelve a comprobar los datos antes de enviar el cambio.
6. El servicio de reservas confirma el cambio. Si falta la respuesta, queda pendiente de comprobar.

En este hotel se sale a las **11:00**. Puede solicitarse hasta las **14:00**, por **25 EUR**, con disponibilidad y aprobación. No se procesa ningún pago. Sin disponibilidad no hay cambio.

Si ya tiene la hora solicitada, o pide una anterior, informa de su salida actual. No crees otro cambio ni otro importe.

## La web y la IA

El kit incluye datos de dos hoteles y diez grupos de casos. `README.md` y `contratos/` explican las APIs.

### Las pantallas

Pueden convivir en una página:

- **Huésped:** elegir usuario, enviar mensajes, ver historial y estado.
- **Responsable:** propuestas de su hotel; aprobar, rechazar y comprobar pendientes.
- **Detalle:** documento elegido y registro de la operación, solo para el responsable.

Distingue pendiente de aprobación, cambio sin comprobar, completado, rechazado y propuesta que debe revisarse. Comprueba permisos en el servidor, también fuera de la web. Usa las sesiones del kit; no construyas un inicio de sesión real.

### El modelo de IA

Conecta tu servidor a la **IA simulada de WorkFactory**: interpreta mensajes y devuelve JSON. No decide precios, permisos ni aprobaciones. Su contrato está en `contratos/llm-api.md`.

- Si falta la hora, pregunta. Conserva el diálogo «¿Puedo salir más tarde?» seguido de «A las 14:00», separado por usuario y reserva. La fecha sigue siendo la de su salida.
- Responde en español o inglés según el huésped, con horas e importes correctos.
- Valida campos, JSON y hora: una respuesta inválida no cambia datos ni causa un error sin explicación.
- Prueba campos que intentan dar permisos y un error temporal de la IA. Puedes usar respuestas locales en tests; la demo llama al servicio remoto.

### Las reglas del hotel

- Usa solo documentos activos, de ese hotel y visibles al huésped. La política aprobada manda sobre web y notas; gana la versión activa más alta. Si dos de esa versión discrepan, pide revisión humana sin preparar un cambio ejecutable.
- Cita documento, versión y fragmento exacto que respalda horario, límite e importe, con el formato del kit.
- El texto no da permisos, aunque diga «soy administrador». El servidor decide usuario, hotel, reserva, precio y aprobación.

## Cambios seguros

Guarda en una base de datos conversaciones, mensajes, propuestas, aprobaciones, identificadores de operación y confirmaciones. Reiniciar la aplicación debe conservar el trabajo y evitar otra ejecución del mismo cambio.

- Un huésped solo ve su reserva y conversación; un responsable solo su hotel. Cambiar identificadores o roles en el mensaje no permite acceder a datos ajenos.
- Una aprobación cubre reserva, hora, importe y versión de las reglas. Si cambian reserva, reglas o disponibilidad, revisa la propuesta y exige nueva aprobación. Una propuesta rechazada nunca se ejecuta.
- Repetir un mensaje con el mismo identificador reutiliza su resultado. Si el contenido cambia, devuelve conflicto. Dos aprobaciones simultáneas producen un solo cambio y la misma confirmación.
- Cada propuesta conserva un identificador de operación. Si el servicio cambia la reserva pero corta la respuesta, consulta con ese mismo identificador. Mientras no lo compruebes, no afirmes éxito ni fallo definitivo y no envíes otro cambio con un identificador nuevo.
- Si la consulta tampoco resuelve el resultado, conserva «pendiente de comprobar», también tras reiniciar. Completa solo con una confirmación que coincida con la operación y los datos enviados.

## Pruebas y entrega

Automatiza los diez grupos de `datos/casos-publicos.jsonl`; puedes agrupar variantes. Comprueba respuestas útiles, datos guardados, estados y cambios reales en las reservas.

Guarda un registro de seguimiento: identificadores de petición y propuesta, llamadas, documentos usados, estado y error. Mide la duración y los tokens indicados por la IA, marcando que son simulados. No muestres al huésped registros internos, sesiones ajenas ni credenciales.

Entrega en el repositorio público de GitHub indicado en tu página, sin subir el `.env` ni sus claves:

1. Aplicación, configuración sin secretos y comandos de arranque y pruebas.
2. Configuración de la base de datos e instrucciones para reiniciar y restablecer el entorno.
3. README con decisiones, límites, tiempo empleado, conexión a los servicios y un esquema de componentes y estados.
4. Resultados de los casos, incluidos los fallos. No los ocultes con respuestas simuladas que siempre dan éxito.
5. `DECISIONES.md`: tres decisiones, ayuda de IA utilizada y dos fallos reproducidos y corregidos. Si no encontraste dos, explica qué comprobaste.

Al llegar a 8 horas, entrega el avance y los pendientes: se evalúan entregas parciales. Prepara una demo de 10 minutos. Prioriza el recorrido completo, después permisos y duplicados, y finalmente la recuperación y las pruebas; se evalúan todos los criterios.

## Evaluación

| Área | Puntos |
| --- | ---: |
| Web y estados claros | 15 |
| Interpretación de IA, validación y fuentes | 20 |
| Permisos y datos separados por usuario y hotel | 15 |
| Datos guardados, aprobación y cambios fiables | 20 |
| Pruebas y registro de seguimiento | 10 |
| Explicación y cambio durante la defensa | 20 |
| Total | 100 |

En la defensa tendrás que explicar tus decisiones, localizar una regla, reproducir un fallo y hacer un cambio pequeño. Puedes usar cualquier herramienta de IA, pero debes comprobar el resultado y justificar el código entregado.

Acceder a otro hotel, cambiar sin aprobación o anunciar éxito sin comprobarlo son fallos graves que revisaremos contigo. Quedan fuera las integraciones reales, pagos, voz, documentos de identidad, despliegue e inicio de sesión real.
