import { ReportQuery } from '../../common/query.dto';
import { Choice, Id } from '../../common/validation';

export class ReportExportQuery extends ReportQuery {
  @Choice(['csv', 'xlsx']) formato!: 'csv' | 'xlsx';
  @Id(true, 1, true) conjunto?: number;
}
