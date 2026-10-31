import { OpenAPIObject } from '@nestjs/swagger';
import { documentResponses } from '../../src/common/swagger';

describe('Contrato Swagger de reportes', () => {
  it('filtra reportes fijos sin confundir rutas de exportación con un slug', () => {
    const document: OpenAPIObject = {
      openapi: '3.0.0', info: { title: 'Test', version: '1' },
      paths: {
        '/api/v1/reportes/ingresos': { get: { responses: {}, parameters: [
          { name: 'fechaDesde', in: 'query' }, { name: 'idTecnico', in: 'query' },
        ] } },
        '/api/v1/reportes/{slug}/exportar': { get: { responses: {}, parameters: [
          { name: 'slug', in: 'path', required: true }, { name: 'formato', in: 'query' },
        ] } },
      },
    };
    expect(() => documentResponses(document)).not.toThrow();
    expect(document.paths['/api/v1/reportes/ingresos'].get?.parameters).toEqual([
      { name: 'fechaDesde', in: 'query', required: false },
    ]);
    expect(document.paths['/api/v1/reportes/{slug}/exportar'].get?.parameters).toEqual([
      { name: 'slug', in: 'path', required: true }, { name: 'formato', in: 'query' },
    ]);
    const response = document.paths['/api/v1/reportes/{slug}/exportar'].get?.responses['200'];
    expect(response).toMatchObject({ content: {
      'text/csv': { schema: { type: 'string', format: 'binary' } },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    } });
    expect(response && 'content' in response && response.content?.['application/json']).toBeUndefined();
  });
});
