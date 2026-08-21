# Cómo está puesto en internet

De la computadora de Santiago a `{barbería}.turnosforbarber.com`, andando.

Describe el estado real, no una receta a seguir: esto ya está hecho. Después de
esto, cada barbería nueva es solo correr `crear-barberia`, porque el subdominio
funciona sin tocar nada más: el certificado y el DNS son comodín.

**Estuvo en Vercel hasta el 20 de agosto de 2026.** La mudanza, con el porqué y
el paso a paso, está en `migrar-a-render.md`. Si algo de acá no cuadra con lo que
ves, ese documento tiene la historia.

---

## Las cuatro piezas, y quién hace qué

| | Dónde | Qué hace |
|---|---|---|
| El código | GitHub, `barbershop-calendar` | cada `push` a `main` dispara un despliegue |
| La aplicación | **Render**, servicio web `barbershop-calendar` | corre `next start` |
| La zona DNS | **Vercel**, todavía | resuelve el dominio y guarda el correo |
| El correo | Resend y Supabase | dos sistemas distintos, ver abajo |

⚠️ **La zona DNS sigue en Vercel aunque la aplicación ya no.** Es deliberado: la
mudanza se hizo en dos etapas para poder saber qué se rompió si algo se rompía.
Mover la zona a Porkbun es la etapa 2, pendiente. Mientras tanto, el dominio
depende de una cuenta de Vercel que ya no aloja nada.

---

## El servicio en Render

- **Web Service**, no Static Site: esta aplicación es dinámica de punta a punta.
  El tenant sale del header `host` en cada pedido, hay Server Actions, y la clave
  de servicio tiene que quedarse del lado del servidor.
- Runtime **Node**. Build `npm run build`, start `npm start`.
- Instancia **Starter**. La gratuita se duerme y la primera visita del día tarda
  medio minuto en despertar, que en una página de reservas es fatal.
- **Node 24**, fijado con la variable `NODE_VERSION=24`: no está declarado en
  `engines`, así que sin esa variable Render elige otra.
- ⚠️ **`docs/guia-del-panel.md` tiene que estar en el servidor**, no solo en el
  repositorio: la aplicación lo lee del disco en cada arranque para armar el
  botón de ayuda del panel. `npm start` corre desde la raíz del repositorio, así
  que está. Lo que lo rompería es pasar a `output: "standalone"`, que copia solo
  lo que el rastreo de Next considera necesario y no ve una lectura hecha con
  `path.join(process.cwd(), …)`. Si algún día se hace ese cambio, hay que
  agregarlo a `outputFileTracingIncludes`. El síntoma no sería una caída: la
  ayuda queda vacía y el panel sigue andando, así que nadie se entera.

### Las variables de entorno

Las `NEXT_PUBLIC_*` **se escriben adentro del código al construirlo**, no se leen
en cada visita. Cargadas después del primer build, no entran: hay que volver a
desplegar.

| Variable | Nota |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Saltea RLS. Nunca con prefijo `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `turnosforbarber.com`, sin protocolo ni puerto |
| `NEXT_PUBLIC_APP_URL` | `https://turnosforbarber.com` |
| `NEXT_PUBLIC_CONTACT_WHATSAPP` | |
| `NEXT_PUBLIC_CONTACT_EMAIL` | hoy sin cargar: sin ella la portada no ofrece mail |
| `NEXT_PUBLIC_PRECIO_MENSUAL` | |
| `NEXT_PUBLIC_PRECIO_MONEDA` | |
| `NEXT_PUBLIC_PRECIO_MENSUAL_ALT` | |
| `NEXT_PUBLIC_PRECIO_MONEDA_ALT` | |
| `SOLICITUDES_MAIL` | a dónde llega el aviso de la portada |
| `CRON_SECRET` | lo único que protege `/api/limpiar-demo` |
| `RESEND_API_KEY` | |
| `RESEND_FROM` | `Turnos for Barber <turnos@turnosforbarber.com>` |
| `NODE_VERSION` | `24` |
| `DEV_TENANT_SLUG` · `DEV_ALLOWED_ORIGINS` | **no cargarlas** |

`DEV_TENANT_SLUG` es la salida de emergencia para desarrollar en `localhost`, que
no tiene subdominio. En producción el código la ignora igual, pero cargarla es
dejar escrito que una barbería es especial, y ninguna lo es.

La `SUPABASE_SERVICE_ROLE_KEY` va **sin** el prefijo `NEXT_PUBLIC_`. Es lo que la
mantiene fuera del navegador: Next manda al cliente todo lo que empieza con
`NEXT_PUBLIC_` y nada más. Esa clave saltea RLS entera.

---

## Los dominios

En el servicio → **Settings → Custom Domains** están los tres:

```
*.turnosforbarber.com
turnosforbarber.com        ← redirige a www, lo arma Render solo
www.turnosforbarber.com
```

**Render cuenta 2 de 2 dominios**: el que solo redirige no ocupa cupo. Eso
importa el día que una barbería quiera su propio dominio, que ahí sí suma.

### Los registros, en la zona de Vercel

| Nombre | Tipo | Valor | Para qué |
|---|---|---|---|
| `@` | A | `216.24.57.1` | el dominio pelado |
| `www` | CNAME | `barbershop-calendar-br9c.onrender.com` | la portada |
| `*` | CNAME | `barbershop-calendar-br9c.onrender.com` | cada barbería |
| `_acme-challenge` | CNAME | `barbershop-calendar-br9c.verify.renderdns.com` | el certificado comodín |
| `_cf-custom-hostname` | CNAME | `barbershop-calendar-br9c.hostname.renderdns.com` | la protección de Cloudflare |

El `@` va con `A` y no con `CNAME`: un CNAME en la raíz de un dominio no es
válido.

⚠️ **Vercel tiene dos `ALIAS` propios que no se pueden borrar**, con candado y el
comentario "Vercel automatically manages…". No hace falta: *"adding additional
DNS Records will override the values of them"*. Los registros de arriba los
pisan. Eso también es la vuelta atrás, si alguna vez hace falta: se sacan los
tres primeros y los de Vercel vuelven a mandar solos.

---

## El correo son dos sistemas, y no son el mismo

Los mails de la barbería, confirmación de turno y pedido nuevo, salen por
**Resend**. Los de la cuenta, recuperar contraseña, salen por **Supabase**. Hay
dos configuraciones que pueden estar mal por separado, y ninguna avisa: un fallo
de mail nunca rompe una reserva, a propósito.

### Los cinco registros que no se tocan nunca

```
@                  MX    fwd1.porkbun.com (10), fwd2.porkbun.com (20)
@                  TXT   v=spf1 include:_spf.porkbun.com ~all
send               MX    feedback-smtp.sa-east-1.amazonses.com (10)
send               TXT   v=spf1 include:amazonses.com ~all
resend._domainkey  TXT   p=MIGfMA0GCSqGSIb3DQEB…   ← el DKIM, largo
```

Los tres de `send` y `resend._domainkey` son de Resend. Si se pierden, los mails
de confirmación dejan de salir **en silencio**. Los dos de `@` son el reenvío de
Porkbun, que es lo que hace que una respuesta a `turnos@` llegue a algún lado.

Cuidado con el DKIM al recrearlo: es largo y algunos paneles lo cortan al
pegarlo. Si queda truncado, Resend lo marca como no verificado.

Conviene mirarlos después de cada toque al DNS, que cuesta un comando:

```sh
for r in "turnosforbarber.com MX" "turnosforbarber.com TXT" \
         "send.turnosforbarber.com MX" "send.turnosforbarber.com TXT" \
         "resend._domainkey.turnosforbarber.com TXT"; do
  set -- $r
  echo "$1 ($2): $(curl -s "https://dns.google/resolve?name=$1&type=$2" | grep -o 'data[^,]*' | head -2)"
done
```

### Supabase tiene que conocer el dominio

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://turnosforbarber.com`
- **Redirect URLs**: `https://*.turnosforbarber.com/**`

El comodín es lo que hace que el link de recuperar contraseña vuelva a la
barbería correcta. Sin eso, Supabase rechaza el redirect y la persona queda
mirando un error después de pedir su clave nueva.

Dejar también las de desarrollo (`http://localhost:3000/**`,
`http://*.lvh.me:3000/**`): conviven sin problema y sacarlas rompe las pruebas.

---

## La tarea que vacía la demo

`.github/workflows/limpiar-demo.yml`, todos los días a las 06:00 UTC. Render no
lee `vercel.json`, y su servicio de tareas programadas cuesta un mínimo de un
dólar por mes: `/api/limpiar-demo` es un endpoint HTTP y una acción de GitHub lo
llama gratis.

El `CRON_SECRET` va como **secreto del repositorio** en GitHub (*Settings →
Secrets and variables → Actions*), con el mismo valor que la variable en Render.

⚠️ Apunta al `www` y **no** al dominio pelado. El pelado devuelve un 301, `curl`
sin `-L` no lo sigue, y `--fail-with-body` solo falla con 400 o más: contra el
pelado la tarea quedaba en verde sin haber limpiado nunca.

---

## Probar contra producción, no contra la pantalla del panel

Que el despliegue diga "live" no dice nada sobre si una persona puede reservar.

```
node --env-file=.env.local scripts/probar-cliente.mts demo https://demo.turnosforbarber.com
node --env-file=.env.local scripts/probar-mail.mts <tu-mail>
node --env-file=.env.local scripts/probar-recuperar.mts <tu-mail> demo
node --env-file=.env.local scripts/probar-solicitud.mjs https://www.turnosforbarber.com/
```

Las dos del correo hay que correr **las dos**: que ande una no dice nada de la
otra.

Y una cuenta que hay que hacer, no mirar. Uno de cada ocho pedidos volvía 404 en
el primer despliegue, y abierta a mano la página cargaba bien:

```sh
ok=0; fail=0
for i in $(seq 1 40); do
  c=$(curl -s -o /dev/null -w '%{http_code}' https://www.turnosforbarber.com/)
  if [ "$c" = "200" ]; then ok=$((ok+1)); else fail=$((fail+1)); fi
done
echo "200: $ok  fallos: $fail"
```

⚠️ **Hay una capa de Cloudflare delante de Render.** Una ráfaga de 40 pedidos
desde la misma IP le parece un ataque y los corta: eso no es la aplicación caída.
Si sale todo mal de golpe, espaciarlos.

### El DNS de tu casa miente

Después de un cambio de DNS, el router de la red local sigue devolviendo las
direcciones viejas mucho más de lo que dice el TTL. Se ve como un **404 que dice
"The deployment could not be found on Vercel"**, y es facilísimo leerlo como que
algo salió mal.

Peor: no es parejo. `curl` recibía Render y Chromium recibía Vercel **al mismo
tiempo**, así que una prueba automática puede fallar con el sitio andando
perfecto.

Para saber la verdad hay que no preguntarle al resolvedor local:

```sh
curl -s "https://dns.google/resolve?name=www.turnosforbarber.com&type=A"
curl -s --resolve "www.turnosforbarber.com:443:216.24.57.7" https://www.turnosforbarber.com/
```

Para el navegador, el equivalente es lanzarlo con
`--host-resolver-rules=MAP www.turnosforbarber.com <ip>`.

---

## Lo que conviene saber

**El certificado comodín cubre un nivel solo.** `tropi.turnosforbarber.com` sí;
`a.b.turnosforbarber.com` no. No importa: `slugFromHost` ya rechaza los
subdominios anidados a propósito.

**Un subdominio que no es de nadie responde el 404 nuestro**, en castellano ("No
encontramos esa página"), no el de fábrica de Next.

**Los dominios propios de cada barbería**, que una use `tubarber.com` en vez del
subdominio, se agregan uno por uno en Render, requieren que la dueña toque su
propio DNS, y **suman al cupo de dominios**, que hoy está en 2 de 2.

**512 MB de RAM y 5 GB de tráfico** es lo que trae el plan. Medido: la portada
pesa 584 KB por visita nueva y la página de una barbería 283 KB. Las barberías no
son el riesgo; un reel que funcione, sí. Pasado el límite son $0.15 por GB.

**En el plan gratuito de Render no hay registro de pedidos HTTP.** Es el motivo
más probable de tener que pasar a Pro algún día: cuando una dueña diga "no me
anda" y no haya dónde mirar.
