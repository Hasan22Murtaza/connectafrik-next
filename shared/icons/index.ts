/**
 * ConnectAfrik icon set — Lucide-compatible API.
 * Mapped icons come from shared/icons/svg; remaining names re-export lucide-react.
 */
export type { Icon as AppIcon, IconProps } from "./createIcon";
export type { LucideIcon } from "lucide-react";

import {
  Activity as ActivityIcon,
  Add,
  Archive as ArchiveIcon,
  Attachment,
  Back,
  Bell as BellIcon,
  Bookopen,
  Calendar as CalendarIcon,
  Camera as CameraIcon,
  Chart,
  Check as CheckIcon,
  Clock as ClockIcon,
  Close,
  Comment,
  Crown as CrownIcon,
  Edit as EditIcon,
  Eye as EyeIcon,
  Fil,
  Files as FilesIcon,
  Filter as FilterIcon,
  Gift as GiftIcon,
  Heart as HeartIcon,
  Home as HomeIcon,
  House as HouseIcon,
  Inbox as InboxIcon,
  Incoming,
  Info as InfoIcon,
  Landmark as LandmarkIcon,
  Listfilter,
  Location as LocationIcon,
  Map as MapIcon,
  Market,
  Megaphone as MegaphoneIcon,
  Member,
  Messagesquare,
  Mic as MicIcon,
  Micoff,
  Missed,
  More,
  Movie,
  Msg,
  Off,
  Order,
  Outgoing,
  Palette as PaletteIcon,
  Phone as PhoneIcon,
  Photo,
  Pin as PinIcon,
  ReactIcon,
  Repeat as RepeatIcon,
  Report,
  Right,
  Rsvp,
  Save as SaveIcon,
  Search as SearchIcon,
  Send as SendIcon,
  Share as ShareIcon,
  Shop,
  Shoppingbag,
  Sparkles as SparklesIcon,
  Tag as TagIcon,
  Tapin,
  Target as TargetIcon,
  Trash,
  Undo as CircleCheckIcon,
  Untapin,
  UserRoundX as UserRoundXIcon,
  Useradd,
  Userremove,
  Users as UsersIcon,
  Video as VideoIcon,
  World,
} from "./generated";

// --- Semantic names from the new set ---
export {
  ActivityIcon as Activity,
  Add,
  ArchiveIcon as Archive,
  Attachment,
  Back,
  BellIcon as Bell,
  Bookopen,
  CalendarIcon as Calendar,
  CameraIcon as Camera,
  Chart,
  CheckIcon as Check,
  ClockIcon as Clock,
  Close,
  Comment,
  CrownIcon as Crown,
  EditIcon as Edit,
  EyeIcon as Eye,
  Fil,
  FilesIcon as Files,
  FilterIcon as Filter,
  GiftIcon as Gift,
  HeartIcon as Heart,
  HomeIcon as Home,
  HouseIcon as House,
  InboxIcon as Inbox,
  Incoming,
  InfoIcon as Info,
  LandmarkIcon as Landmark,
  Listfilter,
  LocationIcon as Location,
  MapIcon as Map,
  Market,
  MegaphoneIcon as Megaphone,
  Member,
  Messagesquare,
  MicIcon as Mic,
  Micoff,
  Missed,
  More,
  Movie,
  Msg,
  Off,
  Order,
  Outgoing,
  PaletteIcon as Palette,
  PhoneIcon as Phone,
  Photo,
  PinIcon as Pin,
  ReactIcon,
  RepeatIcon as Repeat,
  Report,
  Right,
  Rsvp,
  SaveIcon as Save,
  SearchIcon as Search,
  SendIcon as Send,
  ShareIcon as Share,
  Shop,
  Shoppingbag,
  SparklesIcon as Sparkles,
  TagIcon as Tag,
  Tapin,
  TargetIcon as Target,
  Trash,
  CircleCheckIcon as Undo,
  Untapin,
  UserRoundXIcon as UserRoundX,
  Useradd,
  Userremove,
  UsersIcon as Users,
  VideoIcon as Video,
  World,
};

// --- Lucide-compatible aliases (visual/semantic match to provided SVGs) ---
export const Plus = Add;
export const Paperclip = Attachment;
export const ChevronLeft = Back;
/** Provided "back" glyph is chevron-left */
export const ArrowLeft = Back;
export const BookOpen = Bookopen;
export const ChartLine = Chart;
export const TrendingUp = Chart;
export const X = Close;
export const MessageSquare = Messagesquare;
export const MessagesSquare = Messagesquare;
export const MessageCircle = Msg;
export const SquarePen = EditIcon;
export const Edit2 = EditIcon;
export const Pencil = EditIcon;
export const FileText = Fil;
export const File = Fil;
export const ListFilter = Listfilter;
/** map.svg is a map-pin glyph */
export const MapPin = MapIcon;
/** location.svg is a navigation/location arrow */
export const Navigation = LocationIcon;
export const ShoppingBag = Shoppingbag;
export const ShoppingCart = Market;
export const Package = Order;
export const Store = Shop;
export const Building = Shop;
export const UserCheck = Member;
export const UserPlus = Tapin;
export const UserMinus = Untapin;
export const UserX = Report;
export const Users2 = UsersIcon;
export const UserRoundPlus = Useradd;
export const UserRoundMinus = Userremove;
export const UserRoundCheck = Member;
export const MicOff = Micoff;
export const PhoneOff = Off;
export const PhoneMissed = Missed;
export const PhoneIncoming = Incoming;
export const PhoneOutgoing = Outgoing;
/** Closest directional call glyphs in the set */
export const ArrowDownLeft = Incoming;
export const ArrowUpRight = Outgoing;
export const MoreHorizontal = More;
export const MoreVertical = More;
export const Film = Movie;
export const Clapperboard = Movie;
export const Image = Photo;
export const ImagePlus = Photo;
export const Images = Photo;
export const ThumbsUp = ReactIcon;
export const RefreshCw = RepeatIcon;
export const ChevronRight = Right;
export const ArrowRight = Right;
export const CirclePlus = Rsvp;
export const SquarePlus = Rsvp;
export const Bookmark = SaveIcon;
export const Share2 = ShareIcon;
export const Trash2 = Trash;
/** Provided "undo" file is actually circle-check */
export const CheckCircle = CircleCheckIcon;
export const CheckCircle2 = CircleCheckIcon;
export const Globe = World;

// --- No equivalent in the new set — keep lucide-react ---
export {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AtSign,
  Award,
  BadgeCheck,
  Ban,
  BarChart3,
  BellOff,
  Bold,
  BookmarkX,
  Briefcase,
  Building2,
  Cake,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ChevronsRight,
  Code,
  Compass,
  Copy,
  CreditCard,
  Crosshair,
  DollarSign,
  Download,
  ExternalLink,
  EyeOff,
  Facebook,
  FileCheck,
  Flag,
  Folder,
  Forward,
  Hash,
  Headphones,
  HelpCircle,
  Icon,
  Instagram,
  Italic,
  Languages,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  Loader,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Maximize,
  Maximize2,
  Menu,
  Minimize,
  Minus,
  MinusCircle,
  Monitor,
  MonitorOff,
  MonitorUp,
  Moon,
  Music,
  Newspaper,
  PartyPopper,
  Pause,
  PinOff,
  Play,
  Printer,
  QrCode,
  Quote,
  Repeat2,
  Reply,
  RotateCcw,
  Settings,
  Settings2,
  Shield,
  ShieldCheck,
  ShieldOff,
  Smile,
  Square,
  Star,
  Strikethrough,
  Sun,
  Theater,
  Truck,
  Twitter,
  Upload,
  User,
  UserRound,
  VideoOff,
  Volume1,
  Volume2,
  VolumeX,
  Wallet,
  XCircle,
  Youtube,
  Zap,
  ZoomIn,
  ZoomOut,
  TrendingDown,
} from "lucide-react";
