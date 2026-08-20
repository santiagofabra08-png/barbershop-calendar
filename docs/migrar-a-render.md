# Mudarse de Vercel a Render

Escrito antes de empezar, para que el plan no dependa de la memoria de nadie.
Complementa `desplegar.md`, que describe cómo está armado hoy en Vercel.

## Por qué

**No es por plata, aunque también.** El plan Hobby de Vercel dice, con todas las
letras, *"the Hobby plan restricts users to non-commercial, personal use only"*.
Este producto se le cobra a barberías. El día que Vercel lo haga cumplir se caen
todos los clientes a la vez, sin aviso y sin nada que negociar.

Los números, verificados contra la documentación de ellos en agosto de 2026:

| | Vercel Pro | **Render Hobby** | Render Pro |
|---|---|---|---|
| Plan del espacio de trabajo | $20 | $0 | $25 |
| Máquina (Starter, 0.5 CPU / 512 MB) | incluida | $7 | $7 |
| Tarea programada | incluida | $1 | $1 |
| Dominio extra (hacen falta 3, Hobby trae 2) | — | $0.25 | — |
| **Total** | **$20** | **$8.25** | **$33** |

Ojo con la última columna: **si algún día hace falta el plan Pro de Render, sale
más caro que Vercel.** El ahorro vive mientras alcance el plan gratuito.

Render cambió los planes el 23 de abril de 2026 y separó el precio del espacio
de trabajo del de la máquina. Es el detalle que hace que "son 7 dólares" sea
falso.

## El momento

**Se hace ahora porque todavía no hay ningún cliente.** Tropi es una maqueta y
las demos son nuestras: hoy el corte no le arruina el día a nadie. Con la
primera barbería real adentro, esta misma mudanza pasa a ser una operación
delicada. Ver "Ninguna barbería de la base es un cliente todavía" en `CLAUDE.md`.

---

## La zona DNS, tal como está hoy

Consultado el 19 de agosto de 2026 contra `8.8.8.8` y `1.1.1.1`. **El dominio se
compró en Porkbun pero la zona la manejan los nameservers de Vercel**
(`ns1.vercel-dns.com`, `ns2.vercel-dns.com`), así que estos registros viven
adentro de Vercel y no existen en ningún otro lado. De ahí que estén acá.

| Nombre | Tipo | Valor | Para qué |
|---|---|---|---|
| `@` | A | `216.198.79.1`, `216.198.79.65` | Vercel · **se cambia** |
| `*` | A | los mismos | Vercel, el comodín · **se cambia** |
| `www` | A | los mismos | Vercel · **se cambia** |
| `@` | MX | `fwd1.porkbun.com`, `fwd2.porkbun.com` | Reenvío de correo de Porkbun · **no tocar** |
| `@` | TXT | `v=spf1 include:_spf.porkbun.com ~all` | Lo mismo · **no tocar** |
| `send` | TXT | `v=spf1 include:amazonses.com ~all` | Resend · **no tocar** |
| `send` | MX | `feedback-smtp.sa-east-1.amazonses.com` | Resend · **no tocar** |
| `resend._domainkey` | TXT | `p=MIGfMA0GCSqGSIb3DQEB…` (DKIM) | Resend · **no tocar** |

**Los tres registros de Resend están bien puestos y el dominio está verificado.**
Se comprobó uno por uno: si esos tres se pierden, los mails de confirmación
dejan de salir **en silencio**, porque un fallo de mail nunca rompe una reserva,
a propósito.

No hay registro `_dmarc`. No hace falta para que Resend funcione, pero conviene
agregarlo alguna vez.

### Un hallazgo suelto que resuelve un pendiente

**Ya existe reenvío de correo de Porkbun sobre el dominio** (los MX apuntan a
`fwd1/fwd2.porkbun.com`). O sea que lo de "`turnos@` es un remitente y no una
casilla, así que si un cliente contesta la confirmación esa respuesta se pierde"
puede estar **a una regla de distancia**: entrar al panel de Porkbun y ver si
`turnos@turnosforbarber.com` reenvía a algún lado. Si no, se crea ahí mismo.

---

## En dos etapas, y no en una

La tentación es mudar el hosting y la zona DNS de una sola vez. **No conviene**,
y no por el riesgo total sino por poder saber qué se rompió:

- **Etapa 1 · El hosting.** La zona se queda en Vercel; solo se cambian los tres
  registros que apuntan a la aplicación. Los de Resend y los de Porkbun no se
  tocan ni una vez. Si algo falla, es Render.
- **Etapa 2 · La zona.** Más adelante y con calma, mover los nameservers a
  Porkbun, que es donde está comprado el dominio, recreando la tabla de arriba.
  Si algo falla, es el DNS.

Una variable por vez. Y la etapa 1 sola ya cumple el objetivo: sacar el hosting
comercial de un plan que no permite uso comercial.

## Lo único que puede salir mal de verdad

**El comodín.** Todo el producto vive en `{slug}.turnosforbarber.com`. Si el
certificado comodín no sale, no hay migración que valga 12 dólares por mes.

Render lo soporta y pide que **el dominio pelado también apunte a Render**.

---

## Etapa 1, paso a paso

### 1 · Crear el servicio en Render

- **New → Web Service**, desde el repositorio de GitHub.
- Región: la más cercana (Ohio o São Paulo).
- Build: `npm run build` · Start: `npm start`
- Instancia: **Starter ($7)**. La gratuita se duerme y la primera visita del día
  tarda medio minuto en despertar, que en una página de reservas es fatal.
- **Node 24.** No está declarado en `engines`, así que hay que fijarlo con la
  variable `NODE_VERSION=24`.

### 2 · Cargar las variables ANTES del primer build

Las `NEXT_PUBLIC_*` se escriben adentro del código al construirlo, no se leen en
cada visita. Cargadas después del build, no entran.

| Variable | Nota |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Saltea RLS. Nunca con prefijo `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `turnosforbarber.com`, sin protocolo ni puerto |
| `NEXT_PUBLIC_APP_URL` | `https://turnosforbarber.com` |
| `NEXT_PUBLIC_CONTACT_WHATSAPP` | |
| `NEXT_PUBLIC_CONTACT_EMAIL` | |
| `NEXT_PUBLIC_PRECIO_MENSUAL` | |
| `NEXT_PUBLIC_PRECIO_MONEDA` | |
| `NEXT_PUBLIC_PRECIO_MENSUAL_ALT` | |
| `NEXT_PUBLIC_PRECIO_MONEDA_ALT` | |
| `SOLICITUDES_MAIL` | A dónde llega el aviso de la portada |
| `CRON_SECRET` | Lo único que protege `/api/limpiar-demo` |
| `RESEND_API_KEY` | |
| `RESEND_FROM` | `Turnos for Barber <turnos@turnosforbarber.com>`. **Cambia respecto de Vercel**, que dice `Tropi Barbershop`: de acá sale solo la dirección para los mails de las barberías, pero el nombre se usa tal cual en el aviso de la portada, que no es de ninguna barbería. |
| `NODE_VERSION` | `24` |
| `DEV_TENANT_SLUG` · `DEV_ALLOWED_ORIGINS` | **No cargarlas.** Son de desarrollo: en producción se ignoran, pero dejarlas invita a un accidente el día que alguien las lea sin contexto. |

### 3 · Verificar en el `onrender.com`, antes de tocar el DNS

La URL que da Render no tiene subdominio de barbería, así que ahí se tiene que
ver **la portada**. Con eso alcanza para saber que el build y el arranque están
bien, sin haberle movido nada al dominio todavía.

**Mirar la página una vez no alcanza: hay que contar.** En el primer despliegue,
uno de cada ocho pedidos volvía `404` con el header `x-render-routing: no-server`,
que es Render diciendo que no encontró instancia viva a la que mandarlo. Abierta
a mano la página cargaba bien y el control pasaba; lo que se rompía era cuando el
pedido perdido era el del CSS, y entonces la portada aparecía sin ningún estilo.

```sh
ok=0; fail=0
for i in $(seq 1 40); do
  c=$(curl -s -o /dev/null -w '%{http_code}' https://<tu-app>.onrender.com)
  if [ "$c" = "200" ]; then ok=$((ok+1)); else fail=$((fail+1)); fi
done
echo "200: $ok  fallos: $fail"
```

Tiene que dar **40 de 40**. Si no:

- **Scaling** tiene que decir 1 instancia.
- **Manual Deploy → Restart service** vuelve a registrar la instancia y limpia
  la ruta muerta.
- Si persiste, es infraestructura de Render y va a soporte. No hay nada del lado
  de la aplicación que produzca ese header.

Y no seguir al DNS hasta que dé limpio: con el dominio ya apuntado, esto mismo se
ve como una página rota cada ocho visitas, con clientes adentro.

### 4 · Agregar los dominios en Render

En el servicio → **Settings → Custom Domains**, agregar los tres:

- `turnosforbarber.com`
- `www.turnosforbarber.com`
- `*.turnosforbarber.com`

Render va a mostrar, para cada uno, qué registro espera. Anotarlos: llevan el id
del servicio adentro.

**El redirect del pelado a `www` lo resuelve Render solo.** En Vercel eso era un
308 de la plataforma, no del código, y se iba a perder al migrar: quedaban dos
direcciones sirviendo la misma portada. Al agregar `www`, Render agrega el
dominio pelado por su cuenta y lo deja redirigiendo. No hay que hacer nada, pero
sí hay que mirar que la lista lo diga.

El apex va con un registro **`A` a `216.24.57.1`**, no con el CNAME que muestra el
cuadro: un CNAME en la raíz de un dominio no es válido, y el propio cuadro lo
aclara abajo.

### 5 · Cambiar los registros en Vercel DNS

Acá empieza el corte. En Vercel → Domains → `turnosforbarber.com` → DNS.

**Se borran** los A de `@`, `www` y `*` que apuntan a `216.198.79.*`.

**Se agregan:**

| Nombre | Tipo | Valor |
|---|---|---|
| `@` | A | `216.24.57.1` (o ALIAS al `onrender.com` si Vercel lo permite) |
| `www` | CNAME | `<tu-app>.onrender.com` |
| `*` | CNAME | `<tu-app>.onrender.com` |
| `_acme-challenge` | CNAME | `<id-del-servicio>.verify.renderdns.com` |
| `_cf-custom-hostname` | CNAME | `<id-del-servicio>.hostname.renderdns.com` |

⚠️ **No tocar los MX, ni el TXT del `@`, ni nada que empiece con `send` o
`resend._domainkey`.** Son el correo, y no tienen nada que ver con el hosting.

⚠️ **Borrar los AAAA si hay alguno**: Render es solo IPv4.

### 6 · Esperar el certificado y probar, en este orden

1. `turnosforbarber.com` → la portada
2. `demo.turnosforbarber.com` → la barbería demo, **y reservar de verdad**
3. `tropi-barbershop.turnosforbarber.com` → otra barbería, con su propia marca

El punto 3 es el que prueba que el comodín anda. El 2, que anda la base.

### 7 · Rearmar la tarea que vacía la demo

Hoy la dispara `vercel.json`, que en Render no se lee. En Render las tareas
programadas son un servicio aparte con un mínimo de **$1 por mes**, pero se
puede evitar: `/api/limpiar-demo` es un endpoint HTTP y el repositorio ya está
en GitHub, así que una acción programada de GitHub lo llama gratis. El
`CRON_SECRET` va como secreto del repositorio y viaja en el header
`Authorization: Bearer`.

**Hay que dejarla andando el mismo día.** Sin limpieza, en unas semanas la demo
no tiene un horario libre para mostrar, y una demo llena no demuestra nada.

Y la regla que no se afloja: ese borrado filtra siempre por `tenant_id`. Ese
`eq` es lo único que separa "vaciar la demo" de "borrarle la agenda a un
cliente".

### 8 · Las pruebas contra producción

```
node --env-file=.env.local scripts/probar-cliente.mts demo https://demo.turnosforbarber.com
node --env-file=.env.local scripts/probar-mail.mts
node --env-file=.env.local scripts/probar-recuperar.mts
node --env-file=.env.local scripts/probar-solicitud.mjs https://turnosforbarber.com
```

Las dos del medio hay que correr **las dos**: son dos configuraciones de correo
distintas —Resend para los mails de la barbería, Supabase para los de la
cuenta— y que ande una no dice nada de la otra.

### 9 · Dejar Vercel prendido una semana

Apagado del DNS pero sin borrar el proyecto.

**Volver atrás es poner los A de `216.198.79.*` de nuevo.** Nada más. Por eso el
proyecto no se borra hasta que pase una semana tranquila.

---

## Lo que no hay que tocar

**Supabase no se toca.** El dominio no cambia, así que los *Redirect URLs*
(`https://*.turnosforbarber.com/**`) siguen sirviendo igual.

**Resend no se toca.** El dominio está verificado y sus tres registros quedan
donde están.

## Lo que hay que mirar después, sin apuro

- **512 MB de RAM.** Next.js entra, pero la optimización de imágenes come
  memoria. La máquina siguiente cuesta $25 y se lleva el ahorro entero. Si
  aprieta hay margen: las capturas de la portada ya vienen optimizadas del
  script y se podrían servir sin pasar por el optimizador.
- **5 GB de ancho de banda.** Medido contra producción: la portada pesa 584 KB
  por visita nueva (incluye la demo adentro del iframe) y la página de una
  barbería 283 KB. O sea unas 9.000 visitas de portada por mes. **Las barberías
  no son el riesgo; un reel que funcione, sí.** Pasado el límite son $0.15 por
  GB: un mes bueno de Instagram cuesta dos dólares, no un susto.
- **Sumar barberías no cambia la factura.** El comodín cuenta como un solo
  dominio, tenga 1 barbería o 40. Recién suma $0.25 por mes el día que una
  quiera su propio dominio.
- **En el plan gratuito no hay registro de pedidos HTTP.** Es el motivo más
  probable de tener que pasar a Pro alguna vez: el día que una dueña diga "no me
  anda" y no haya dónde mirar.

## Fuentes

Verificado en agosto de 2026. Si pasó tiempo, volver a mirar: Render ya cambió
los planes una vez este año.

- <https://render.com/docs/new-workspace-plans>
- <https://render.com/docs/custom-domains>
- <https://render.com/docs/configure-other-dns>
- <https://render.com/docs/compute-plans>
- <https://render.com/docs/cronjobs>
- <https://vercel.com/docs/plans/hobby>
