import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/api";

const Navbar = () => {
  const [userInitials, setUserInitials] = useState<string>("");

  useEffect(() => {
    const fetchUser = async () => {
      const res = await api.get("/api/user/");
      const { fullname } = res.data;
      const [first, last] = fullname.split(" ");
      setUserInitials(first[0] + last[0]);
    };
    fetchUser();
  }, []);
  const navigate = useNavigate();

  // State for dropdown menu
  const [open, setOpen] = useState(false);

  function LogOutf() {
    localStorage.clear();
    navigate("/login");
  }

  return (
    <nav className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
      {/* Left side - Home link */}
      <div>
        <a
          href="/"
          className="font-medium text-lg hover:text-gray-600 transition-colors"
        >
          Home
        </a>
      </div>

      {/* Right side - Avatar with dropdown */}
      <div>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-gray-200 transition-all">
              <AvatarFallback className="bg-gray-800 text-white">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="mt-1">
            <DropdownMenuItem onClick={LogOutf} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};

export default Navbar;
