import { useState, FormEvent, ChangeEvent } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "@/constants";

interface FormData {
  fullname: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  home: string;
  office: string;
  carrier: string;
}

const SignUpPage = () => {
  const [formData, setFormData] = useState<FormData>({
    fullname: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    home: "",
    office: "",
    carrier: ""
  });
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  // Check if all fields are filled
  const isFormComplete = (): boolean => {
    return Object.values(formData).every(value => value.trim() !== "");
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    if (!isFormComplete()) {
      setErrorMessage("Please fill in all fields");
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }
    
    setLoading(true);

    try {
      const res=await api.post("api/user/register/", {
        fullname: formData.fullname,
        username: formData.username,
        email: formData.email,
        home_address: formData.home,
        office_address: formData.office,
        carrier: formData.carrier,
        password: formData.password,
      });
      let data=res.data;
      localStorage.setItem(ACCESS_TOKEN,data.access);
      localStorage.setItem(REFRESH_TOKEN,data.refresh);
      navigate("/");

    } catch (error) {
      setErrorMessage("An error occurred during registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-4xl shadow-md">
        <CardHeader className="pb-6">
          <CardTitle className="text-2xl font-semibold text-center">Create your account</CardTitle>
          <CardDescription className="text-center">
            Fill in your details to create a new account
          </CardDescription>
        </CardHeader>

        {errorMessage && (
          <Alert className="bg-destructive/10 border-destructive/20">
            <AlertDescription className="text-destructive font-medium">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSignUp}>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullname" className="text-sm">Full Name</Label>
                <Input
                  type="text"
                  id="fullname"
                  value={formData.fullname}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm">Username</Label>
                <Input
                  type="text"
                  id="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Choose a username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email Address</Label>
                <Input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="carrier" className="text-sm">Carrier</Label>
                <Input
                  type="text"
                  id="carrier"
                  value={formData.carrier}
                  onChange={handleChange}
                  placeholder="Enter your carrier"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="home" className="text-sm">Home Address</Label>
                <Input
                  type="text"
                  id="home"
                  value={formData.home}
                  onChange={handleChange}
                  placeholder="Enter your home address"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="office" className="text-sm">Office Address</Label>
                <Input
                  type="text"
                  id="office"
                  value={formData.office}
                  onChange={handleChange}
                  placeholder="Enter your office address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">Password</Label>
                <Input
                  type="password"
                  id="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a strong password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm">Confirm Password</Label>
                <Input
                  type="password"
                  id="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col p-6 border-t">
            <Button
              type="submit"
              disabled={loading || !isFormComplete()}
              className="w-full"
            >
              {loading ? "Creating account..." : "Sign up"}
            </Button>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have an account?{" "}
              <Link className="text-primary hover:underline font-medium" to="/login">
                Log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default SignUpPage;