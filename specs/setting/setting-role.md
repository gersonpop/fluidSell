# Especificacion: Modulo de configuracion por empresa y general

## Contexto
Se requiere centralizar la configuracion de la aplicacion en un unico modulo administrable por SU, permitiendo distinguir claramente entre cambios por empresa y cambios globales para toda la plataforma.

## Objetivo
Permitir que el SU seleccione de forma segura e intuitiva el alcance de una configuracion (`Empresa` o `General`) y realice modificaciones con claridad sobre a quien impactan los cambios.

## Usuario principal
Super Usuario (SU).

## Historia de usuario
Como SU, quiero ingresar a un modulo de configuracion, elegir si voy a modificar una empresa especifica o la opcion `General`, y editar los parametros correspondientes para aplicar cambios correctamente segun el alcance seleccionado.

## Alcance
- Acceso al modulo de configuracion para SU.
- Seleccion de alcance de configuracion: empresa especifica o `General`.
- Visualizacion de listado de empresas existentes junto con la opcion `General`.
- Edicion de configuraciones segun el alcance seleccionado.
- Separacion visual clara del modulo en dos paneles:
  - Panel izquierdo (1/4): navegacion/definicion de secciones de configuracion.
  - Panel derecho (3/4): detalle y edicion de configuraciones.
- Inclusion de una tarea formal de diseno UI/UX para definir la interfaz completa del modulo con foco en usabilidad e intuicion.

## Fuera de alcance
- Definir implementacion tecnica (frameworks, APIs, modelo de datos detallado, arquitectura).
- Gestion de creacion o mantenimiento de empresas en catalogo (se asume existente).
- Definicion de permisos para otros roles distintos de SU.
- Flujos avanzados de auditoria, versionado o rollback no solicitados.

## Reglas funcionales
1. El modulo solo debe estar disponible para usuarios con rol SU.
2. El SU debe definir el alcance antes de editar cualquier configuracion.
3. El sistema debe ofrecer dos tipos de alcance: `Empresa` y `General`.
4. Si el alcance es `Empresa`, el SU debe seleccionar una empresa del listado disponible.
5. Si el alcance es `General`, los cambios se consideran globales para toda la plataforma.
6. Las configuraciones editadas en alcance `Empresa` no deben afectar otras empresas.
7. La interfaz debe mantener visible el alcance activo durante la edicion.
8. La distribucion visual del modulo debe respetar el patron 1/4 izquierda y 3/4 derecha como base de diseno.
9. Debe existir una actividad/tarea de UI/UX para entregar propuesta integral del modulo, incluyendo jerarquia visual, navegacion y estados.

## Estados y casos borde
- Estado inicial: sin alcance seleccionado, no se permite edicion hasta seleccionar `Empresa` o `General`.
- Estado empresa seleccionada: se habilita edicion contextual a esa empresa.
- Estado general seleccionado: se habilita edicion global.
- Estado sin empresas disponibles: debe mantenerse operativa la opcion `General`; para `Empresa`, mostrar mensaje claro de indisponibilidad.
- Cambio de alcance con edicion en curso: debe evitar ambiguedad y dejar claro que el contexto cambia (con confirmacion o advertencia de contexto).
- Error de permisos: si un usuario no SU intenta acceder, el acceso debe denegarse.
- Estado vacio de configuraciones: mostrar interfaz clara para indicar que no hay valores configurados aun.

## Criterios de aceptacion
- El SU puede ingresar al modulo y visualizar opcion `General` y listado de empresas.
- El SU no puede editar configuraciones sin haber seleccionado previamente un alcance.
- Al seleccionar una empresa, los cambios quedan asociados solo a esa empresa.
- Al seleccionar `General`, los cambios quedan asociados al alcance global.
- La interfaz muestra de manera evidente el alcance activo en todo momento.
- La estructura visual del modulo refleja panel izquierdo 1/4 y panel derecho 3/4.
- Existe una tarea definida para experto UI/UX con objetivo de disenar el modulo completo y hacerlo intuitivo.
- Un usuario sin rol SU no puede usar el modulo.

## Suposiciones confirmadas
1. Solo el rol SU accede y guarda cambios en este modulo.
2. La seleccion de alcance (`Empresa` o `General`) es obligatoria antes de editar.
3. El alcance por empresa impacta solo a la empresa seleccionada.
4. El alcance `General` impacta a toda la plataforma.
5. El listado de empresas ya existe y esta disponible junto con `General`.
6. Se incluye tarea explicita para experto UI/UX.
7. Layout base del modulo: izquierda 1/4, derecha 3/4.
8. La interfaz prioriza claridad para evitar errores de alcance.
