import fs from 'fs/promises';
import path from 'path';

const AREAS_DIR = './content/areas';

async function splitAreaFiles() {
  try {
    const files = await fs.readdir(AREAS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'index.json');

    for (const file of jsonFiles) {
      const areaId = file.replace('.json', '');
      const filePath = path.join(AREAS_DIR, file);
      const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

      // Crear carpeta del área si no existe
      const areaFolder = path.join(AREAS_DIR, areaId);
      await fs.mkdir(areaFolder, { recursive: true });

      // Crear index.json
      const indexData = {
        areaId: data.areaId,
        scenarioIds: data.scenarios.map(sc => sc.id)
      };
      await fs.writeFile(
        path.join(areaFolder, 'index.json'),
        JSON.stringify(indexData, null, 2),
        'utf-8'
      );

      // Crear archivos individuales
      for (const scenario of data.scenarios) {
        await fs.writeFile(
          path.join(areaFolder, `${scenario.id}.json`),
          JSON.stringify(scenario, null, 2),
          'utf-8'
        );
        console.log(`✅ Creado: ${areaId}/${scenario.id}.json`);
      }

      // Opcional: renombrar el archivo original como backup
      await fs.rename(
        filePath,
        path.join(AREAS_DIR, `${file}.backup`)
      );
      console.log(`📦 Backup creado: ${file}.backup`);
    }

    console.log('🎉 ¡Todos los archivos divididos con éxito!');
  } catch (error) {
    console.error('💥 Error durante la división:', error.message);
  }
}

splitAreaFiles();
