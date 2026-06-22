# Asado Pro

Calculadora de asado para Río Gallegos y clima patagónico. Estima carne, chorizos, morcillas, achuras, carbón, leña, bebidas, acompañamientos y escote por persona según cantidad de comensales, corte, escenario de cocción, temperatura y viento.

## Funciones

- Ajuste por quincho, chulengo o fuego a la intemperie.
- Factor térmico por viento, frío y escenario de cocción.
- Desglose opcional por hombres, mujeres y niños.
- Modos de carne con gramos diferenciados: vacuno con hueso, vacuno sin hueso, premium mix, cerdo, pollo, vacuno/cerdo y vacuno/pollo.
- Bebidas, hielo, pan, ensaladas, papas, provoleta y salsas calculadas según el grupo.
- Lista de compras editable con progreso, ítems personalizados y categorías.
- Estimación de gastos y costo por persona.
- Pronóstico de parrilla con Open-Meteo: mejor horario, ráfagas, lluvia y alerta de viento.
- Historial local de asados con feedback `sobró / faltó / perfecto` para calibrar futuras compras.
- PWA con manifest y service worker para uso offline.

## Gramos base de carne

| Modo | Hombre | Mujer | Niño |
| --- | ---: | ---: | ---: |
| Vacuno sin hueso | 400 g | 300 g | 185 g |
| Vacuno con hueso | 550 g | 400 g | 250 g |
| Premium mix | 480 g | 360 g | 220 g |
| Cerdo | 450 g | 330 g | 220 g |
| Pollo | 600 g | 450 g | 300 g |
| Mixto vacuno/cerdo | 500 g | 370 g | 230 g |
| Mixto vacuno/pollo | 550 g | 400 g | 260 g |

## Desarrollo

```bash
npm install
npm run dev
```

## Validación

```bash
npm run lint
npm run build
```
