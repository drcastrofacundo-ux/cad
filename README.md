# Protocolo de Crisis Hiperglucémicas

Cetoacidosis diabética y estado hiperosmolar en pacientes de 15 años o más.

**Versión 1.0 · Septiembre 2026**
Redacción: Dr. Facundo Agustín Castro

Servicios de Terapia Intensiva:
Hospital Nacional de Clínicas (Córdoba) · Hospital de Unquillo · Sanatorio Punilla (Villa Carlos Paz) · Clínica Santa María (Alta Gracia)

## Contenido

| Archivo | Para quién | Qué hace |
|---|---|---|
| `index.html` | — | Portada |
| `ingreso.html` | Médico | Clasificación diagnóstica, anion gap, prescripción por peso, constancia para historia clínica |
| `enfermeria.html` | Enfermería | Hoja de bomba de insulina, versión por institución, imprimible A4 |
| `transicion.html` | Médico | Verifica resolución y calcula NPH mañana/noche + prandial al pasar de bomba a subcutánea |
| `protocolo.pdf` | Comité | Documento completo con justificación y bibliografía |

## Bibliografía

1. Umpierrez GE, et al. Hyperglycemic Crises in Adults With Diabetes: A Consensus Report. *Diabetes Care* 2024;47(8):1257-1275. PMID 39052901.
2. American Diabetes Association. 16. Diabetes Care in the Hospital: Standards of Care in Diabetes-2026. *Diabetes Care* 2026;49(Suppl 1):S339. PMID 41358892.
3. Glaser N, et al. ISPAD Clinical Practice Consensus Guidelines 2022. *Pediatr Diabetes* 2022;23(7):835-856. PMID 36250645.
4. Fry K, et al. Success of Insulin Infusion Transitions in Moderate to Severe DKA. *Hosp Pharm* 2024;59(3):334-340. PMID 38764987.
5. Saleem F, Sharma A. NPH Insulin. StatPearls [Internet]. StatPearls Publishing; 2023. NBK549860.

Bibliografía verificada al 23/08/2026. Próxima revisión obligatoria: agosto 2027.

## Estado

Aprobado por dirección y por el comité, con revisión de diabetología.

Bibliografía verificada al 23/08/2026. Próxima revisión obligatoria: agosto 2027.

## Publicación

Se sirve desde Netlify y **no se indexa en buscadores**: `robots.txt` y la
cabecera `X-Robots-Tag` de `_headers` lo mantienen fuera de Google. Llega quien
recibe el enlace o el QR, no quien busca "protocolo cetoacidosis". El sitio
sigue siendo accesible para cualquiera que tenga la dirección: no es un control
de acceso, es no figurar en resultados de búsqueda.

Se instala en el celular como app desde el navegador: ícono en la pantalla de
inicio, pantalla completa y funcionamiento sin señal.

- **Android:** botón «⬇ Instalar la app» al pie. Si no aparece, menú de Chrome →
  «Instalar aplicación» (no «Agregar a pantalla principal», que crea un acceso
  directo al navegador en vez de la app).
- **iPhone:** Safari → Compartir → «Agregar a inicio».

### Cache: red primero

El service worker consulta la red antes que el cache. Es deliberado y no hay que
invertirlo: esto calcula dosis de insulina, y bajo cache-first una corrección
publicada puede tardar en llegar mientras alguien sigue prescribiendo con la
versión vieja. Con señal gana la versión vigente; sin señal, la última guardada.
Al pie se muestra la fecha de publicación de la copia instalada, y un aviso
cuando está sirviendo la guardada.

Al tocar cualquier archivo hay que subir la constante `VERSION` en `sw.js` **y**
en `registrar-sw.js` (las dos tienen que coincidir), o los teléfonos seguirán
con el cache viejo. Si se agrega un archivo servido, hay que sumarlo a `FILES`
de `sw.js`, o no funcionará sin señal.

```
node tests/pwa.test.js
```

Ese test verifica las dos cosas y varias más.
