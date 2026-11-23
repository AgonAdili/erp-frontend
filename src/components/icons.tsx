/** The one icon set: Solar "-linear" (480 Design, CC BY 4.0), self-hosted as one sprite (public/icons/solar.svg,
 * built by scripts/build-icons.mjs). Each icon is a component named by what it shows; it is decorative
 * (aria-hidden) unless the caller labels it. */
import type { CSSProperties, SVGProps } from "react";

import NAMES from "./icon-names.json";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & { className?: string; style?: CSSProperties };
export type IconType = (props: IconProps) => React.JSX.Element;

const SPRITE = `${import.meta.env.BASE_URL}icons/solar.svg`;

function make(glyph: string): IconType {
  const Icon = ({ className, ...rest }: IconProps) => (
    <svg className={className ? `ico ${className}` : "ico"} aria-hidden focusable="false" {...rest}>
      <use href={`${SPRITE}#${glyph}`} />
    </svg>
  );
  return Icon;
}

const n = NAMES as Record<string, string>;

export const AlertTriangle = make(n.AlertTriangle);
export const Archive = make(n.Archive);
export const ArrowDown = make(n.ArrowDown);
export const ArrowDownRight = make(n.ArrowDownRight);
export const ArrowRight = make(n.ArrowRight);
export const ArrowUp = make(n.ArrowUp);
export const ArrowUpRight = make(n.ArrowUpRight);
export const BarChart3 = make(n.BarChart3);
export const Bell = make(n.Bell);
export const BookOpen = make(n.BookOpen);
export const Bookmark = make(n.Bookmark);
export const Building2 = make(n.Building2);
export const Calendar = make(n.Calendar);
export const ChartLine = make(n.ChartLine);
export const Check = make(n.Check);
export const CheckCheck = make(n.CheckCheck);
export const CheckCircle2 = make(n.CheckCircle2);
export const ChevronDown = make(n.ChevronDown);
export const ChevronLeft = make(n.ChevronLeft);
export const ChevronRight = make(n.ChevronRight);
export const ChevronsUpDown = make(n.ChevronsUpDown);
export const Circle = make(n.Circle);
export const Clock = make(n.Clock);
export const Columns3 = make(n.Columns3);
export const Compass = make(n.Compass);
export const Construction = make(n.Construction);
export const Copy = make(n.Copy);
export const CornerUpLeft = make(n.CornerUpLeft);
export const Download = make(n.Download);
export const ExternalLink = make(n.ExternalLink);
export const Eye = make(n.Eye);
export const EyeOff = make(n.EyeOff);
export const FileSignature = make(n.FileSignature);
export const FileSpreadsheet = make(n.FileSpreadsheet);
export const FileText = make(n.FileText);
export const Filter = make(n.Filter);
export const Handshake = make(n.Handshake);
export const HardHat = make(n.HardHat);
export const History = make(n.History);
export const Hourglass = make(n.Hourglass);
export const House = make(n.House);
export const Inbox = make(n.Inbox);
export const Info = make(n.Info);
export const Keyboard = make(n.Keyboard);
export const LayoutGrid = make(n.LayoutGrid);
export const Lock = make(n.Lock);
export const LogIn = make(n.LogIn);
export const LogOut = make(n.LogOut);
export const Menu = make(n.Menu);
export const MessageSquare = make(n.MessageSquare);
export const Monitor = make(n.Monitor);
export const Moon = make(n.Moon);
export const MoreHorizontal = make(n.MoreHorizontal);
export const PanelLeftClose = make(n.PanelLeftClose);
export const PanelLeftOpen = make(n.PanelLeftOpen);
export const Paperclip = make(n.Paperclip);
export const Pencil = make(n.Pencil);
export const Pin = make(n.Pin);
export const Plus = make(n.Plus);
export const Printer = make(n.Printer);
export const Question = make(n.Question);
export const RefreshCw = make(n.RefreshCw);
export const Rows3 = make(n.Rows3);
export const Rows4 = make(n.Rows4);
export const Save = make(n.Save);
export const Search = make(n.Search);
export const SearchX = make(n.SearchX);
export const Send = make(n.Send);
export const Settings = make(n.Settings);
export const ShoppingCart = make(n.ShoppingCart);
export const SlidersHorizontal = make(n.SlidersHorizontal);
export const Star = make(n.Star);
export const Sun = make(n.Sun);
export const Table2 = make(n.Table2);
export const Trash2 = make(n.Trash2);
export const Truck = make(n.Truck);
export const Upload = make(n.Upload);
export const User = make(n.User);
export const Users = make(n.Users);
export const Wallet = make(n.Wallet);
export const Warehouse = make(n.Warehouse);
export const X = make(n.X);
export const XCircle = make(n.XCircle);
