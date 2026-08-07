# Poner la aplicación en internet

De la computadora de Santiago a `{barbería}.turnosforbarber.com`, andando.

Se hace una sola vez. Después, cada barbería nueva es solo correr
`crear-barberia` — el subdominio ya funciona sin tocar nada más, porque el
certificado y el DNS son comodín.

---

## El orden importa, y este es el motivo

El paso 3 **muda el DNS de Porkbun a Vercel**. No es opcional: un dominio
comodín (`*.turnosforbarber.com`) es la única forma de que cada barbería nueva
tenga su subdominio sin que nadie toque un registro, y Vercel solo emite el
certificado comodín si maneja el DNS él mismo. Necesita responder un desafío
DNS cada vez que renueva el certificado, y para eso tiene que poder escribir.

La consecuencia es la trampa de todo esto: **al cambiar los nameservers, los
registros que están en Porkbun dejan de existir para el mundo.** Incluidos los
tres de Resend. Si se mudan los nameservers y no se rehacen esos tres, los mails
de confirmación dejan de salir y nada avisa —un fallo de mail nunca rompe una
reserva, a propósito—.

Por eso los registros de Resend se cargan en Vercel **antes** de tocar los
nameservers en Porkbun, y no después. Vercel deja escribir la zona desde que el
dominio existe en la cuenta; simplemente nadie la consulta todavía. Cuando los
nameservers cambian, esos tres registros ya están del otro lado esperando y el
correo no se cae ni un minuto.

Al revés —mudar primero y cargar después— el correo queda roto todo el tiempo
que tardes en acordarte.

---

## 1 · El código a GitHub

Hoy el proyecto existe en una carpeta, en una computadora. Eso ya es un motivo
suficiente, pero además es lo que le permite a Vercel desplegar solo: `git push`
y a los dos minutos está arriba.

En github.com → **New repository**:

- Nombre: `barbershop-calendar`
- **Private**
- **Sin** README, sin .gitignore, sin licencia — el repositorio ya los tiene y
  agregarlos desde la web crea un conflicto al primer push.

Y después, acá:

```
git remote add origin https://github.com/<usuario>/barbershop-calendar.git
git push -u origin main
```

`.env.local` no se sube: está en `.gitignore`. Las credenciales viajan por otro
lado (paso 2).

---

## 2 · El proyecto en Vercel

vercel.com → **Add New → Project** → importar el repositorio.

Framework Next.js, detectado solo. No tocar los comandos de build.

**Antes de darle Deploy**, cargar las variables de entorno. Son las mismas de
`.env.local` con dos cambiadas y una que no va:

| Variable | Valor en producción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | igual que en `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | igual que en `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | igual que en `.env.local` |
| `RESEND_API_KEY` | igual que en `.env.local` |
| `RESEND_FROM` | igual que en `.env.local` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | **`turnosforbarber.com`** ← cambia |
| `NEXT_PUBLIC_APP_URL` | **`https://turnosforbarber.com`** ← cambia |
| `DEV_TENANT_SLUG` | **no cargarla** |

`DEV_TENANT_SLUG` es la salida de emergencia para desarrollar en `localhost`,
que no tiene subdominio. En producción el código la ignora igual, pero cargarla
es dejar escrito que una barbería es especial, y ninguna lo es.

La `SUPABASE_SERVICE_ROLE_KEY` va **sin** el prefijo `NEXT_PUBLIC_`. Es lo que
la mantiene fuera del navegador: Next manda al cliente todo lo que empieza con
`NEXT_PUBLIC_` y nada más. Esa clave saltea RLS entera.

---

## 3 · El dominio comodín

En el proyecto → **Settings → Domains → Add Domain**, y agregar **dos**:

```
turnosforbarber.com
*.turnosforbarber.com
```

Al guardar el comodín, Vercel activa sus nameservers solo y muestra cuáles son
—generalmente `ns1.vercel-dns.com` y `ns2.vercel-dns.com`, pero **copiar los que
muestre la pantalla**, no estos—.

**Anotarlos y no cambiar nada en Porkbun todavía.** Primero va el paso 4.

---

## 4 · Cargar los registros de Resend en Vercel (antes de mudar)

En Vercel → **el dominio → DNS Records**, cargar estos tres. Son los que están
hoy en Porkbun, sacados de la API de Resend, así que están completos y sin
tipear a mano:

**1 · DKIM — la firma que prueba que el mail es tuyo**

```
Tipo:   TXT
Nombre: resend._domainkey
Valor:  p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDQaADYJI2L4OZzwLqfrKfjgvayvITsBjpK0c5jfrmo49wuI0CD6ui2bVGo6CAzdcY+OCwxA1nFr/HgeAdHNHK9yYKsqxkmHCsuu3jOi8goicEiW2GNMpPRBfpOKbH23Hit/zskpYXvjWwCftSQwpp2Utg5QlS8bLo271v/IcAsgQIDAQAB
```

**2 · SPF (MX) — a dónde vuelven los rebotes**

```
Tipo:      MX
Nombre:    send
Valor:     feedback-smtp.sa-east-1.amazonses.com
Prioridad: 10
```

**3 · SPF (TXT) — quién tiene permiso de mandar en nombre del dominio**

```
Tipo:   TXT
Nombre: send
Valor:  v=spf1 include:amazonses.com ~all
```

Cuidado con el DKIM: es largo y algunos paneles lo cortan al pegarlo. Si queda
truncado, Resend lo marca como no verificado.

Con los tres cargados, la zona de Vercel ya es una copia completa de lo que
importa de Porkbun. Recién ahí:

---

## 5 · Mudar los nameservers

En Porkbun → el dominio → **NS / Nameservers** → reemplazar los de Porkbun por
los de Vercel, los que quedaron anotados en el paso 3.

Tarda entre unos minutos y unas horas en propagarse. Vercel muestra el estado
del dominio; cuando pasa a válido, emite el certificado comodín solo.

Cuando propague, en resend.com/domains el dominio tiene que seguir diciendo
**verified**. Si dice *pending*, esperar: está mirando un DNS a medio propagar.

Y después, la prueba de verdad, que no es la pantalla de Resend:

```
node --env-file=.env.local scripts/probar-mail.mts
node --env-file=.env.local scripts/probar-recuperar.mts
```

Las **dos**. Son dos sistemas de correo distintos —el del local sale por Resend,
el de la cuenta por Supabase— y que ande uno no dice nada del otro.

---

## 6 · Supabase tiene que conocer el dominio nuevo

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://turnosforbarber.com`
- **Redirect URLs**: agregar `https://*.turnosforbarber.com/**`

El comodín es lo que hace que el link de recuperar contraseña vuelva a la
barbería correcta. Sin eso, Supabase rechaza el redirect y la persona queda
mirando un error después de pedir su clave nueva.

Dejar también las de desarrollo (`http://localhost:3000/**`,
`http://*.lvh.me:3000/**`): conviven sin problema y sacarlas rompe las pruebas.

---

## 7 · Probar contra producción, no contra la pantalla de Vercel

Que el despliegue diga "Ready" no dice nada sobre si una persona puede reservar.

```
node --env-file=.env.local scripts/probar-cliente.mts tropi-barbershop https://tropi-barbershop.turnosforbarber.com
```

Reserva un turno de verdad, abre el link, cancela, y verifica que el hueco vuelva
a quedar libre. Es la única prueba que abre la aplicación de verdad, y con la
URL de producción la abre **allá**.

Y a mano, una vez, desde el celular: entrar, reservar, y que llegue el mail.

---

## Lo que queda pendiente y conviene saber antes

**El dominio pelado muestra un 404.** `turnosforbarber.com` sin subdominio no es
ninguna barbería, así que la aplicación no tiene qué mostrar y responde el 404
de fábrica de Next: en inglés y con la tipografía por defecto. Funcionalmente
está bien —no hay nada que mostrar— pero es la primera pantalla que ve un dueño
de barbería que escribe el dominio para ver qué es esto. Vale una página propia
antes de salir a vender.

**Un subdominio equivocado también.** `cualquier-cosa.turnosforbarber.com`
resuelve, llega a la aplicación y responde 404. Correcto, pero el mismo 404 feo.

**El certificado comodín cubre un nivel solo.** `tropi.turnosforbarber.com` sí;
`a.b.turnosforbarber.com` no. No importa: `slugFromHost` ya rechaza los
subdominios anidados a propósito.

**Los dominios propios de cada barbería** —que una use `tropibarber.com` en vez
del subdominio— son otra cosa y van después. Se agregan uno por uno en Vercel y
requieren que el dueño toque su propio DNS.
