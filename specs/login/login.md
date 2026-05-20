# Especificacion: Inicio de sesion y recuperacion de contrasena por jefe

## Contexto
La aplicacion necesita un mecanismo de acceso basado en DNI y contrasena, junto con un proceso de recuperacion de contrasena controlado desde la propia aplicacion para evitar bloqueos de acceso del usuario.

## Objetivo
Permitir que el usuario inicie sesion de forma segura con validaciones claras y que, en caso de olvidar su contrasena, pueda solicitar un restablecimiento que su jefe gestione dentro de la aplicacion.

## Usuario principal
Usuario de la aplicacion que accede con DNI y contrasena.

## Historia de usuario
Como usuario de la aplicacion, quiero ingresar con mi DNI y contrasena, y si olvido mi contrasena, quiero que mi jefe pueda restablecerla desde la aplicacion para recuperar mi acceso.

## Alcance
Incluye:
- Pantalla de inicio de sesion con campos `DNI` y `contrasena`.
- Validacion del formato del DNI.
- Validacion de reglas de contrasena.
- Acceso exitoso cuando las credenciales son correctas.
- Opcion `Olvide mi contrasena`.
- Envio de solicitud de restablecimiento al jefe del usuario.
- Gestion del restablecimiento por parte del jefe dentro de la aplicacion.
- Envio de contrasena provisional al telefono del usuario.
- Obligacion de cambiar la contrasena provisional al volver a ingresar.

## Fuera de alcance
- Registro de nuevos usuarios.
- Cambio voluntario de jefe o reasignacion organizacional.
- Definicion del canal tecnico exacto de envio entre WhatsApp y SMS.
- Reglas tecnicas de cifrado, almacenamiento o integracion externa.

## Reglas funcionales
1. El usuario debe autenticarse usando su DNI y su contrasena.
2. El DNI debe aceptar solo caracteres numericos.
3. El DNI se usa como identificador unico de acceso.
4. La contrasena debe tener al menos 8 caracteres.
5. La contrasena debe incluir al menos una letra mayuscula.
6. La contrasena debe ser alfanumerica, es decir, debe combinar letras y numeros.
7. Si el DNI o la contrasena no cumplen el formato requerido, el sistema debe mostrar un mensaje claro de validacion.
8. Si las credenciales son correctas, el usuario debe acceder a la aplicacion.
9. La pantalla de inicio de sesion debe mostrar una opcion `Olvide mi contrasena`.
10. Al activar la opcion de recuperacion, la aplicacion debe generar una solicitud dirigida al jefe del usuario.
11. Cada usuario debe tener un jefe previamente definido en la aplicacion para poder procesar la solicitud.
12. El jefe debe poder revisar la solicitud y restablecer la contrasena del usuario desde la aplicacion.
13. Una vez restablecida, el usuario debe recibir una contrasena provisional en su telefono por WhatsApp o mensaje de texto.
14. La contrasena provisional puede ser la misma que el usuario usaba anteriormente.
15. En el siguiente ingreso exitoso con la contrasena provisional, el sistema debe obligar al usuario a cambiarla antes de continuar usando la aplicacion.
16. La nueva contrasena definida por el usuario debe volver a cumplir las reglas de validacion establecidas.

## Estados y casos borde
- Estado inicial: usuario ve formulario de acceso con opcion de recuperacion.
- Estado de error de validacion: el sistema informa si el DNI no es numerico o si la contrasena no cumple las reglas.
- Estado de credenciales incorrectas: el sistema informa que no fue posible iniciar sesion.
- Estado de solicitud enviada: el usuario recibe confirmacion de que la solicitud fue derivada a su jefe.
- Estado sin jefe asignado: la solicitud no puede completarse y el sistema debe informar que no existe un jefe configurado.
- Estado de contrasena provisional activa: el usuario puede ingresar, pero debe cambiar la contrasena antes de continuar.
- Caso borde: si el jefe aun no restablece la contrasena, el usuario no puede recuperar el acceso por este flujo.
- Caso borde: si el usuario recibe la contrasena provisional pero no la cambia al ingresar, no debe poder avanzar al resto de la aplicacion.

## Criterios de aceptacion
1. Dado un usuario en la pantalla de login, cuando ingresa un DNI con caracteres no numericos, entonces el sistema rechaza el valor e informa el error.
2. Dado un usuario en la pantalla de login, cuando ingresa una contrasena con menos de 8 caracteres, entonces el sistema muestra un mensaje de validacion.
3. Dado un usuario en la pantalla de login, cuando ingresa una contrasena sin mayuscula o sin combinacion de letras y numeros, entonces el sistema muestra un mensaje de validacion.
4. Dado un usuario con credenciales correctas, cuando inicia sesion, entonces accede a la aplicacion.
5. Dado un usuario que olvido su contrasena, cuando selecciona `Olvide mi contrasena`, entonces el sistema genera una solicitud para su jefe.
6. Dado un usuario con jefe asignado, cuando el jefe restablece la contrasena desde la aplicacion, entonces el usuario recibe una contrasena provisional en su telefono por WhatsApp o SMS.
7. Dado un usuario que recibe una contrasena provisional, cuando inicia sesion con ella, entonces el sistema le exige cambiarla antes de permitirle continuar.
8. Dado un usuario sin jefe asignado, cuando intenta recuperar su contrasena, entonces el sistema informa que no es posible procesar la solicitud.

## Suposiciones confirmadas
1. El DNI es el identificador unico de acceso y solo acepta digitos, sin puntos, espacios ni guiones.
2. La contrasena debe tener al menos 8 caracteres, incluir al menos una letra mayuscula y combinar letras y numeros.
3. Si el usuario ingresa un DNI o contrasena invalidos, el sistema muestra un mensaje claro indicando que los datos no cumplen el formato requerido.
4. Si las credenciales son correctas, el usuario accede directamente a la aplicacion.
5. La opcion `Olvide mi contrasena` esta disponible en la pantalla de inicio de sesion.
6. Cuando el usuario olvida su contrasena, la aplicacion envia una solicitud o mensaje interno a su jefe inmediato.
7. Cada usuario tiene un jefe previamente definido dentro de la aplicacion para poder dirigir la solicitud.
8. El jefe puede revisar la solicitud dentro de la aplicacion y restablecer la contrasena del usuario desde ahi.
9. Cuando la contrasena es restablecida, el usuario recibe en su telefono por WhatsApp o mensaje de texto una contrasena provisional que debe cambiar al ingresar.
10. El restablecimiento realizado por el jefe reemplaza la contrasena anterior y permite al usuario volver a ingresar con la nueva contrasena provisional.
