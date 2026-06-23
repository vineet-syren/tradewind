import { Autocomplete, Checkbox, TextField } from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

export function MultiSelectFilter<T extends string | number>({
  label,
  options,
  value,
  onChange,
  width = 200,
  format,
}: {
  label: string;
  options: T[];
  value: T[];
  onChange: (next: T[]) => void;
  width?: number;
  format?: (v: T) => string;
}) {
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      size="small"
      options={options}
      value={value}
      onChange={(_, v) => onChange(v as T[])}
      getOptionLabel={(o) => (format ? format(o) : String(o))}
      limitTags={1}
      sx={{ width, minWidth: 160 }}
      renderOption={(props, option, { selected }) => {
        const { key, ...rest } = props as { key: string } & React.HTMLAttributes<HTMLLIElement>;
        return (
          <li key={key} {...rest}>
            <Checkbox icon={<CheckBoxOutlineBlankIcon fontSize="small" />} checkedIcon={<CheckBoxIcon fontSize="small" />} checked={selected} sx={{ mr: 1 }} />
            {format ? format(option) : String(option)}
          </li>
        );
      }}
      renderInput={(params) => <TextField {...params} label={label} placeholder={value.length ? '' : 'All'} />}
    />
  );
}
