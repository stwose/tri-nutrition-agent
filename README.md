# Agente nutricional para triatlon

MVP estatico para planificar nutricion diaria a partir de un perfil de atleta y una tabla de entrenamientos futuros.

## Abrir

Abre `index.html` en el navegador. No necesita servidor ni dependencias.

## Publicar en GitHub Pages

1. Crea un repositorio publico en GitHub, por ejemplo `tri-nutrition-agent`.
2. Sube estos archivos a la raiz del repositorio:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. En GitHub, entra en `Settings` -> `Pages`.
4. En `Build and deployment`, elige:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guarda la configuracion.

La app quedara disponible en una URL similar a:

```text
https://stwose.github.io/tri-nutrition-agent/
```

## Que incluye

- Perfil inicial de triatleta: mujer, 50 anos, 162 cm, 55 kg.
- Objetivo: rendimiento, fuerza y resistencia para media/larga distancia, con Full Ironman en octubre.
- Restricciones: sin lactosa, sin gluten y sin ajo.
- Tabla editable de entrenamientos futuros.
- Generador de plan de triatlon de 14 o 28 dias.
- Importacion/exportacion CSV.
- Clasificacion del dia: descanso, fuerza, doble sesion, intenso, fondo, brick.
- Objetivos diarios de kcal, carbohidratos, proteina, grasas, hidratacion y sodio.
- Recomendaciones de platos adaptadas a las intolerancias.

## Tabla de entrenamientos

Cada fila es una sesion. Si un dia tiene bici y carrera, se crean dos filas.

Campos principales:

- `date`
- `start_time`
- `sport`
- `environment`
- `session_type`
- `duration_min`
- `intensity`
- `planned_tss`
- `description`

El objetivo es que esta tabla actue como proveedor temporal del calendario deportivo. Mas adelante puede reemplazarse por un conector real:

```text
CSVTrainingPlanProvider -> TrainingPeaksProvider
```

## Logica del agente

El motor local:

1. Lee sesiones del dia y del dia siguiente.
2. Clasifica la demanda deportiva.
3. Estima gasto del entrenamiento.
4. Calcula rangos diarios de macros.
5. Genera timing de comida alrededor del entreno.
6. Propone platos sin lactosa, sin gluten y sin ajo.

Los calculos son una base de producto, no una pauta medica cerrada.
