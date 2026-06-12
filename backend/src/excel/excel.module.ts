import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { WriteExcelExecutor } from './executors/write-excel.executor';
import { ExcelAddSheetExecutor } from './executors/excel-add-sheet.executor';
import { ExcelChartExecutor } from './executors/excel-chart.executor';

@Module({
  providers: [ExcelService, WriteExcelExecutor, ExcelAddSheetExecutor, ExcelChartExecutor],
  exports: [ExcelService, WriteExcelExecutor, ExcelAddSheetExecutor, ExcelChartExecutor],
})
export class ExcelModule {}
