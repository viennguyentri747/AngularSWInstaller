import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'fileSize',
    standalone: true
})
export class FileSizePipe implements PipeTransform {
    transform(size: number): string {
        const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        let power = Math.floor(Math.log(size) / Math.log(1024));
        power = Math.min(power, units.length - 1); // Prevent exceeding the range of units

        const scaledSize = size / Math.pow(1024, power); // Scale size down to appropriate unit
        return `${scaledSize.toFixed(2)} ${units[power]}`; // Format with two decimals and unit
    }
}