/**
 * Dar de alta una barbería nueva, preguntando.
 *
 *   node --env-file=.env.local scripts/crear-barberia.mts
 *
 * Reemplaza al SQL a mano. Va preguntando lo indispensable, con un valor por
 * defecto en casi todo, y al final muestra lo que va a crear antes de crearlo.
 *
 * Lo que se pide acá es lo MÍNIMO para que la página funcione el mismo día:
 * nombre, subdominio, un servicio y un horario. Todo lo demás —los colores
 * finos, el logo, más servicios, el resto del equipo— lo carga el dueño desde
 * el panel, que para eso está. Pedirle veinte datos a alguien que todavía no
 * vio el producto es la forma más rápida de que abandone.
 *
 * Usa la service role key: crea cuentas y saltea RLS. Por eso vive en
 * `scripts/` y no se despliega.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import {
  PALETAS,
  clienteAdmin,
  crearBarberia,
  slugLibre,
  slugSugerido,
  validarHora,
  validarSlug,
  type BarberiaNueva,
  type Ventana,
} from "./lib/alta.mts";

let admin;
try {
  admin = clienteAdmin();
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });

/**
 * Las respuestas, de a una.
 *
 * Con `rl.question` alcanzaba mientras alguien tipeara, pero si la entrada
 * viene de un archivo readline emite todas las líneas de golpe y solo se
 * escucha la primera: las otras veintidós se pierden y el script se queda
 * esperando para siempre. El iterador las va entregando de a una.
 *
 * Eso hace que este script se pueda probar sin que haya nadie tecleando, que
 * para el comando que da de alta a un cliente que paga no es un lujo.
 */
const lineas = rl[Symbol.asyncIterator]();

async function leerLinea(etiqueta: string): Promise<string> {
  stdout.write(etiqueta);
  const { value, done } = await lineas.next();
  if (done) throw new Error("Se cortó la entrada antes de terminar de preguntar.");
  return String(value);
}

// ---- Preguntas --------------------------------------------------------------

/** Pregunta hasta que la respuesta sirva. Enter vacío toma el valor por defecto. */
async function pedir(
  pregunta: string,
  opciones: { defecto?: string; validar?: (v: string) => string | null } = {},
): Promise<string> {
  const { defecto, validar } = opciones;
  for (;;) {
    const etiqueta = defecto ? `${pregunta} [${defecto}]: ` : `${pregunta}: `;
    const crudo = (await leerLinea(etiqueta)).trim();
    const valor = crudo === "" && defecto !== undefined ? defecto : crudo;

    if (valor === "") {
      console.log("  ↳ Esto no puede quedar vacío.");
      continue;
    }
    const problema = validar?.(valor);
    if (problema) {
      console.log(`  ↳ ${problema}`);
      continue;
    }
    return valor;
  }
}

async function pedirNumero(
  pregunta: string,
  defecto: number,
  min: number,
  max: number,
): Promise<number> {
  const v = await pedir(pregunta, {
    defecto: String(defecto),
    validar: (x) => {
      const n = Number(x);
      if (!Number.isFinite(n)) return "Tiene que ser un número.";
      if (n < min || n > max) return `Va de ${min} a ${max}.`;
      return null;
    },
  });
  return Number(v);
}

async function preguntarSiNo(pregunta: string, defecto: boolean): Promise<boolean> {
  const v = await pedir(`${pregunta} (s/n)`, {
    defecto: defecto ? "s" : "n",
    validar: (x) =>
      /^[sn]$/i.test(x.trim()) ? null : "Contestá s o n.",
  });
  return v.toLowerCase() === "s";
}

/** Una lista numerada. Devuelve la clave elegida. */
async function elegir<T extends string>(
  titulo: string,
  opciones: { clave: T; texto: string }[],
  defecto: T,
): Promise<T> {
  console.log(`\n${titulo}`);
  opciones.forEach((o, i) => {
    const marca = o.clave === defecto ? " ←" : "";
    console.log(`  ${i + 1}. ${o.texto}${marca}`);
  });

  const iDefecto = opciones.findIndex((o) => o.clave === defecto) + 1;
  const v = await pedirNumero("Número", iDefecto, 1, opciones.length);
  return opciones[v - 1].clave;
}

const linea = (t = "") => console.log(t);
const titulo = (t: string) => {
  linea(`\n${"─".repeat(62)}`);
  linea(t.toUpperCase());
  linea("─".repeat(62));
};

// ============================================================================

linea("\n  ALTA DE UNA BARBERÍA\n");
linea("  Enter toma el valor entre corchetes. Ctrl+C para salir.");

try {
  // ---- 1. La barbería ------------------------------------------------------
  titulo("La barbería");

  const nombre = await pedir("Nombre del local", {
    validar: (v) => (v.length < 2 ? "Muy corto." : null),
  });

  const slug = await pedir("Subdominio", {
    defecto: slugSugerido(nombre),
    validar: validarSlug,
  });

  if (!(await slugLibre(admin, slug))) {
    linea(`\n✗ Ya hay una barbería con el subdominio "${slug}".`);
    linea("  Elegí otro y volvé a correr el comando.\n");
    process.exit(1);
  }

  const raiz = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tudominio.com";
  linea(`  ↳ La página va a ser  ${slug}.${raiz.split(":")[0]}`);

  const direccion = await pedir("Dirección (o - para dejarla vacía)", {
    defecto: "-",
  });

  const timezone = await pedir("Zona horaria", {
    defecto: "America/Montevideo",
    validar: (v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return null;
      } catch {
        return "No existe esa zona. Ej: America/Montevideo, America/Argentina/Buenos_Aires.";
      }
    },
  });

  const moneda = await pedir("Moneda", {
    defecto: "UYU",
    validar: (v) => (/^[A-Z]{3}$/.test(v) ? null : "Tres letras mayúsculas: UYU, ARS, USD."),
  });

  // ---- 2. Los colores ------------------------------------------------------
  titulo("Los colores");
  linea("Es un punto de partida: el dueño los cambia después desde Ajustes.");

  const paleta = await elegir(
    "¿Cuál le queda mejor?",
    Object.entries(PALETAS).map(([clave, p]) => ({
      clave,
      texto: p.nombre,
    })),
    "clasica",
  );

  // ---- 3. La agenda --------------------------------------------------------
  titulo("La agenda");

  const modo = await elegir(
    "¿Hasta cuándo se puede reservar hacia adelante?",
    [
      { clave: "rolling", texto: "Una ventana móvil de N días (lo habitual)" },
      { clave: "weekly", texto: "Solo la semana en curso; la siguiente se abre un día fijo" },
    ],
    "rolling",
  );

  let ventana: Ventana;
  if (modo === "rolling") {
    ventana = {
      modo: "rolling",
      dias: await pedirNumero("Cuántos días hacia adelante", 21, 1, 180),
    };
  } else {
    const dow = await elegir(
      "¿Qué día se habilita la semana siguiente?",
      [
        { clave: "0", texto: "Domingo" },
        { clave: "1", texto: "Lunes" },
        { clave: "2", texto: "Martes" },
        { clave: "3", texto: "Miércoles" },
        { clave: "4", texto: "Jueves" },
        { clave: "5", texto: "Viernes" },
        { clave: "6", texto: "Sábado" },
      ],
      "6",
    );
    ventana = {
      modo: "weekly",
      dow: Number(dow),
      hora: await pedir("A qué hora (HH:MM)", {
        defecto: "21:00",
        validar: (v) => (validarHora(v) ? null : "Formato HH:MM, ej 21:00."),
      }),
    };
  }

  const minLead = await pedirNumero(
    "Anticipación mínima para reservar, en minutos",
    60,
    0,
    10080,
  );

  const plazoCancelacion = await pedirNumero(
    "Hasta cuántos minutos antes puede cancelar el cliente",
    120,
    0,
    10080,
  );

  // ---- 4. El dueño ---------------------------------------------------------
  titulo("El dueño");
  linea("Es el único que arranca con acceso. Al resto del equipo los invita él.");

  const duenioNombre = await pedir("Nombre", {
    validar: (v) => (v.length < 2 ? "Muy corto." : null),
  });

  const duenioMail = await pedir("Mail (con este entra al panel)", {
    validar: (v) =>
      /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v) ? null : "No tiene forma de mail.",
  });

  const duenioTel = await pedir("Teléfono (o - para dejarlo vacío)", {
    defecto: "-",
  });

  const corta = await preguntarSiNo("¿El dueño también corta?", true);

  // ---- 5. El horario -------------------------------------------------------
  titulo("El horario");
  linea("Solo el del dueño y para arrancar. Lo demás se ajusta desde el panel.");

  const DIAS: { clave: string; texto: string; dias: number[] }[] = [
    { clave: "1-6", texto: "Lunes a sábado", dias: [1, 2, 3, 4, 5, 6] },
    { clave: "2-6", texto: "Martes a sábado", dias: [2, 3, 4, 5, 6] },
    { clave: "1-5", texto: "Lunes a viernes", dias: [1, 2, 3, 4, 5] },
    { clave: "3-0", texto: "Miércoles a domingo", dias: [3, 4, 5, 6, 0] },
  ];

  const cuales = corta
    ? await elegir(
        "¿Qué días abre?",
        DIAS.map((d) => ({ clave: d.clave, texto: d.texto })),
        "2-6",
      )
    : "2-6";

  const dias = corta ? (DIAS.find((d) => d.clave === cuales)?.dias ?? []) : [];

  let tramos: [string, string][] = [];
  if (corta) {
    const desde = await pedir("Abre a las (HH:MM)", {
      defecto: "09:00",
      validar: (v) => (validarHora(v) ? null : "Formato HH:MM."),
    });
    const hasta = await pedir("Cierra a las (HH:MM)", {
      defecto: "19:00",
      validar: (v) =>
        !validarHora(v)
          ? "Formato HH:MM."
          : v <= desde
            ? "Tiene que ser después de la hora de apertura."
            : null,
    });

    const conCorte = await preguntarSiNo("¿Cierra al mediodía?", false);
    if (conCorte) {
      const cierraMediodia = await pedir("Corta a las (HH:MM)", {
        defecto: "13:00",
        validar: (v) =>
          !validarHora(v)
            ? "Formato HH:MM."
            : v <= desde || v >= hasta
              ? "Tiene que caer entre la apertura y el cierre."
              : null,
      });
      const vuelve = await pedir("Vuelve a las (HH:MM)", {
        defecto: "15:00",
        validar: (v) =>
          !validarHora(v)
            ? "Formato HH:MM."
            : v <= cierraMediodia || v >= hasta
              ? "Tiene que caer entre el corte y el cierre."
              : null,
      });
      tramos = [
        [desde, cierraMediodia],
        [vuelve, hasta],
      ];
    } else {
      tramos = [[desde, hasta]];
    }
  }

  // ---- 6. Los servicios ----------------------------------------------------
  titulo("Los servicios");
  linea("Con uno alcanza para abrir. El resto los carga el dueño.");

  const servicios: BarberiaNueva["servicios"] = [];
  for (;;) {
    const n = servicios.length + 1;
    const nom = await pedir(`Servicio ${n} — nombre`, {
      defecto: n === 1 ? "Corte" : "",
      validar: (v) => (v.length < 2 ? "Muy corto." : null),
    });
    const minutos = await pedirNumero(`  ${nom} — cuánto lleva (minutos)`, 40, 5, 480);
    if (minutos % 5 !== 0) {
      linea("  ↳ La grilla se arma de a 5 minutos; se redondea.");
    }
    const precio = await pedirNumero(`  ${nom} — precio en ${moneda}`, 600, 0, 10_000_000);

    servicios.push({
      nombre: nom,
      minutos: Math.round(minutos / 5) * 5,
      precio,
    });

    if (!(await preguntarSiNo("¿Agregás otro servicio?", servicios.length < 2))) {
      break;
    }
  }

  // ---- 7. Confirmar --------------------------------------------------------
  const datos: BarberiaNueva = {
    slug,
    nombre,
    timezone,
    moneda,
    direccion: direccion === "-" ? null : direccion,
    colores: PALETAS[paleta].colores,
    ventana,
    minLead,
    plazoCancelacion,
    vidriera: false,
    servicios,
    barberos: [
      {
        nombre: duenioNombre,
        rol: "owner",
        // Arranca sin arreglo de cobro: el dueño se lleva lo que entra. Si
        // después contrata, se le define a cada uno desde Equipo.
        cobro: { modelo: "revenue_only" },
        dias,
        tramos,
        atiende: corta,
        email: duenioMail,
        telefono: duenioTel === "-" ? undefined : duenioTel,
      },
    ],
  };

  titulo("Así va a quedar");
  linea(`  Barbería    ${datos.nombre}`);
  linea(`  Página      ${slug}.${raiz.split(":")[0]}`);
  linea(`  Dirección   ${datos.direccion ?? "—"}`);
  linea(`  Zona / $    ${timezone} · ${moneda}`);
  linea(`  Colores     ${PALETAS[paleta].nombre}`);
  linea(
    `  Reservas    ${
      ventana.modo === "rolling"
        ? `hasta ${ventana.dias} días adelante`
        : `semana en curso, se abre los ${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][ventana.dow]} ${ventana.hora}`
    }`,
  );
  linea(`  Anticipa    ${minLead} min · cancela hasta ${plazoCancelacion} min antes`);
  linea(`  Dueño       ${duenioNombre} · ${duenioMail}${corta ? " · corta" : " · no corta"}`);
  if (corta) {
    const nombres = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
    linea(
      `  Horario     ${dias.map((d) => nombres[d]).join(" ")} · ${tramos
        .map(([a, b]) => `${a}-${b}`)
        .join(" y ")}`,
    );
  }
  linea("  Servicios");
  for (const s of servicios) {
    linea(`              ${s.nombre} · ${s.minutos} min · ${s.precio} ${moneda}`);
  }
  linea();

  if (!(await preguntarSiNo("¿Lo creo?", true))) {
    linea("\nNo se creó nada.\n");
    process.exit(0);
  }

  // ---- 8. Crear ------------------------------------------------------------
  const { accesos } = await crearBarberia(admin, datos);

  titulo("Listo");
  linea(`  ${datos.nombre} ya existe y se puede reservar.\n`);
  linea(`  Página   https://${slug}.${raiz.split(":")[0]}`);
  linea(`  Panel    https://${slug}.${raiz.split(":")[0]}/entrar\n`);

  for (const a of accesos) {
    linea(`  ${a.nombre} entra con`);
    linea(`     mail        ${a.mail}`);
    linea(`     contraseña  ${a.clave}`);
  }

  linea("\n  ⚠ Anotá la contraseña ahora: no se vuelve a mostrar.");
  linea("     Decile que la cambie apenas entre, desde su nombre arriba a la derecha.\n");

  linea("  Lo que le queda al dueño, desde el panel:");
  linea("     · Ajustes  — subir el logo y ajustar los colores");
  linea("     · Equipo   — dar de alta al resto y definir cómo cobra cada uno");
  linea("     · Servicios— completar la lista");
  linea("     · Local    — prender la vidriera si vende productos\n");

  linea("  Y del lado tuyo, antes de dársela:");
  linea(`     node --env-file=.env.local scripts/probar-reserva.mts ${slug}`);
  linea(`     node --env-file=.env.local scripts/probar-aislamiento.mts ${slug} tropi-barbershop\n`);
} catch (e) {
  console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}\n`);
  console.error("  No quedó nada a medio crear.\n");
  process.exitCode = 1;
} finally {
  rl.close();
}
