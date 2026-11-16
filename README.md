# La Voz del Mundo — V1.0

Primera base de la página web: inicio moderno y adaptable, registro/inicio de sesión con Supabase, selección de país e idioma, listado y filtros de encuestas, votación única por usuario y vista preliminar de resultados.

## Requisitos
- Node.js 20 o superior
- Una cuenta/proyecto gratuito de Supabase para habilitar autenticación y base de datos

## Instalación local
1. Descomprime el proyecto y abre una terminal en esta carpeta.
2. Ejecuta `npm install`.
3. Copia `.env.example` a `.env.local`.
4. En Supabase, crea un proyecto y copia Project URL y anon/public key a `.env.local`.
5. En Supabase > SQL Editor, ejecuta todo `supabase/schema.sql`.
6. En Supabase > Authentication > URL Configuration, añade `http://localhost:3000` como Site URL y Redirect URL.
7. Ejecuta `npm run dev` y abre `http://localhost:3000`.

## Pruebas sugeridas
- Registra dos cuentas de prueba con correos distintos.
- Comprueba que se crea el perfil y guarda país/idioma.
- Inicia sesión y abre las encuestas publicadas.
- Vota en una encuesta. Intenta votar otra vez en la misma: la restricción `one_vote_per_user_per_poll` debe impedirlo.
- Vota en otra encuesta: debe permitirse.
- Revisa el diseño en móvil y escritorio.

## Importante: alcance de esta primera entrega
- Sin credenciales Supabase, la web muestra datos de demostración y el formulario no crea cuentas ni guarda votos.
- La pestaña de resultados todavía es una previsualización visual, no un cálculo real por opción. El siguiente avance debe implementar conteos agregados reales y mostrar porcentajes basados en votos almacenados.
- No incluye todavía publicaciones, comentarios, debates, moderación administrativa, traducción automática, mapa interactivo ni recuperación de contraseña.
- Antes de un lanzamiento público hacen falta pruebas de seguridad, políticas de privacidad y términos, moderación, accesibilidad, protección antiabuso y revisión de las políticas RLS.
- Nunca pongas una `service_role` key en el navegador. Usa solo la clave `anon/public` en `NEXT_PUBLIC_...`.

## Estructura
- `app/page.tsx`: interfaz principal, modal de autenticación, encuestas y voto.
- `app/globals.css`: diseño adaptable.
- `lib/supabase.ts`: cliente Supabase del navegador.
- `supabase/schema.sql`: tablas, políticas RLS, trigger de perfiles, unicidad de voto y encuestas de ejemplo.
