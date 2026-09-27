import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import userModel from '../models/userModal.js'
import dotenv from "dotenv"
dotenv.config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://quavix-ecomerce-platform.onrender.com/auth/google/callback"
  },
  
  async (accessToken, refreshToken, profile, done) => {

    try {
        let user= await userModel.findOne({googleId:profile.id})
        
        const googleImage = profile.photos?.[0]?.value
        ?.replace("=s96-c", "=s400-c");

        if(user){
            if (!user.profileImage && googleImage) {
            user.profileImage = googleImage;
            await user.save();
        }

            return done(null,user)
        }else{
             user=new userModel({
                name:profile.displayName,
                email:profile.emails[0].value,
                googleId:profile.id,
                profileImage: googleImage
            })
            await user.save()
            return done(null,user)
        } 
        
        
    }catch(err){
        return done(err,null)
        
    }
    
  })
);

//session sotre id
passport.serializeUser((user,done)=>{
    done (null,user.id)
})

passport.deserializeUser((id, done) => {
  userModel.findById(id)
    .then(user => done(null, user))
    .catch(err => done(err, null));
});

export default passport;
